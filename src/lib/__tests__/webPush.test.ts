/**
 * @jest-environment node
 *
 * Test that the Web Push encryption produces RFC 8188 compliant
 * aes128gcm content-encoding headers.
 *
 * Regression test: importing ECDH shared secret as { name: 'HKDF' }
 * prevents it from being used in HMAC sign operations, causing
 * "Unable to use this key to sign" at runtime.
 *
 * Regression test: encryptPayload was constructing the header with
 * wrong field order (keyid before record_size) and wrong field sizes
 * (keyid_length as 4-byte uint32 instead of 1-byte uint8), and using
 * 65 bytes of zeros instead of the ephemeral public key as keyid.
 * This prevented browsers from decrypting any Web Push message.
 */
describe('webPush — HKDF key type', () => {
  it('imports ECDH shared secret as HMAC (not HKDF) so HMAC sign works', async () => {
    const sharedBits = new Uint8Array(32).fill(0x42)

    // This must NOT throw — the key must be usable for HMAC sign
    const sharedKey = await crypto.subtle.importKey(
      'raw',
      sharedBits.buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    // HKDF extract: PRK = HMAC-Hash(salt, IKM)
    const salt = new Uint8Array(16)
    const prkRaw = await crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      sharedKey,
      salt.buffer as ArrayBuffer,
    )

    expect(prkRaw).toBeInstanceOf(ArrayBuffer)

    // HKDF expand: import PRK and sign with it
    const prk = await crypto.subtle.importKey(
      'raw',
      prkRaw,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const info = new Uint8Array(10)
    const block = await crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      prk,
      info.buffer as ArrayBuffer,
    )

    expect(new Uint8Array(block).length).toBe(32)
  })
})

describe('webPush — sendWebPush header format (RFC 8188)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sendWebPush } = require('../webPush') as {
    sendWebPush: (
      subscription: string,
      title: string,
      body: string,
      vapidPublicKey: string,
      vapidPrivateKey: string,
      vapidSubject: string,
      data?: Record<string, string>,
    ) => Promise<void>
  }

  // Generate a fresh subscription key pair for the test
  async function generateTestSubscription(): Promise<{
    subscription: string
    keys: { p256dh: string; auth: string; privateKey: CryptoKey }
  }> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    )

    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
    const authSecret = crypto.getRandomValues(new Uint8Array(16))

    // base64url helpers
    const toB64 = (buf: Uint8Array): string =>
      btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const sub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      keys: {
        p256dh: toB64(rawPub),
        auth: toB64(authSecret),
      },
    }

    return {
      subscription: JSON.stringify(sub),
      keys: { ...sub.keys, privateKey: keyPair.privateKey },
    }
  }

  // Generate VAPID keys for the test
  async function generateTestVapidKeys(): Promise<{
    publicKey: string
    privateKey: string
  }> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign'],
    )
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
    // Export as JWK to get the raw private key d (base64url-encoded 32 bytes)
    const jwkPriv = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey & { d: string }

    const toB64 = (buf: Uint8Array): string =>
      btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    return {
      publicKey: toB64(rawPub),
      privateKey: jwkPriv.d,
    }
  }

  it('produces RFC 8188 aes128gcm header: salt(16) | record_size(4) | keyidlen(1) | keyid(65)', async () => {
    const sub = await generateTestSubscription()
    const vapid = await generateTestVapidKeys()

    // Capture the fetch body
    let capturedBody: Uint8Array | null = null
    const origFetch = globalThis.fetch
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      capturedBody = new Uint8Array(init.body as ArrayBuffer)
      return Promise.resolve(new Response('{}', { status: 201 }))
    }) as typeof fetch

    try {
      await sendWebPush(
        sub.subscription,
        'Test Title',
        'Test Body',
        vapid.publicKey,
        vapid.privateKey,
        'mailto:test@chessduo.app',
        { type: 'game_invite', roomId: 'test-room' },
      )

      expect(capturedBody).not.toBeNull()
      const body = capturedBody!

      // Header is: salt(16) | record_size(4 BE) | keyidlen(1) | keyid(keyidlen)
      // The keyidlen should be 65 (P-256 uncompressed point)

      // record_size at bytes 16-19 should be 4096 (0x00001000)
      const recordSize =
        (body[16] << 24) | (body[17] << 16) | (body[18] << 8) | body[19]
      expect(recordSize).toBe(4096)

      // keyid_length at byte 20 should be 65 (P-256 uncompressed public key)
      const keyidLen = body[20]
      expect(keyidLen).toBe(65)

      // keyid at bytes 21-85 should start with 0x04 (uncompressed EC point prefix)
      expect(body[21]).toBe(0x04)

      // Total header length = 16 + 4 + 1 + 65 = 86 bytes
      // Ciphertext starts at byte 86
      const headerLen = 16 + 4 + 1 + keyidLen
      expect(headerLen).toBe(86)

      // Verify there is ciphertext after the header
      const ciphertextLen = body.length - headerLen
      expect(ciphertextLen).toBeGreaterThan(0)

      // AES-GCM with 16-byte tag adds overhead; verify minimum
      expect(ciphertextLen).toBeGreaterThanOrEqual(16)
    } finally {
      globalThis.fetch = origFetch
    }
  })
})
