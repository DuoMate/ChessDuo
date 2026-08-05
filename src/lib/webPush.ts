/**
 * Web Push sender compatible with Cloudflare Workers (uses native Web Crypto API).
 * Replaces the `web-push` library which relies on Node.js crypto APIs.
 *
 * Implements the Web Push protocol (RFC 8030) and VAPID (RFC 8292).
 */

// Base64 URL-safe encoding/decoding
function base64UrlEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4)
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding
  const binary = atob(base64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf
}

// HKDF implementation using Web Crypto
async function hkdf(
  ikm: CryptoKey,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  // Extract
  const prk = await crypto.subtle.importKey(
    'raw',
    await crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, ikm, salt.buffer as ArrayBuffer),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  // Expand
  let okm = new Uint8Array()
  let t = new Uint8Array(0)
  const iterations = Math.ceil(length / 32)
  for (let i = 0; i < iterations; i++) {
    const infoBlock = new Uint8Array(t.length + info.length + 1)
    infoBlock.set(t)
    infoBlock.set(info, t.length)
    infoBlock[infoBlock.length - 1] = i + 1
    t = new Uint8Array(await crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, prk, infoBlock))
    okm = new Uint8Array([...okm, ...t])
  }
  return okm.slice(0, length)
}

// ECDH key agreement + HKDF to derive AES key and nonce
async function derivePushKeys(
  subscriptionKeys: { p256dh: string; auth: string },
): Promise<{ localPublicKey: Uint8Array; aesKey: Uint8Array; nonce: Uint8Array }> {
  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  )

  // Import subscription's public key
  const remotePublicKey = base64UrlDecode(subscriptionKeys.p256dh)
  const remoteKey = await crypto.subtle.importKey(
    'raw',
    remotePublicKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  // Derive shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: remoteKey as CryptoKey },
    localKeyPair.privateKey,
    256,
  )

  const sharedKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  // Derive AES key (16 bytes) and nonce (12 bytes)
  const authSecret = base64UrlDecode(subscriptionKeys.auth)
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: aes128gcm'),
    0,
  ])
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: nonce'),
    0,
  ])

  const aesKey = await hkdf(sharedKey, authSecret, keyInfo, 16)
  const nonce = await hkdf(sharedKey, authSecret, nonceInfo, 12)

  // Export local public key (uncompressed format, 65 bytes)
  const localPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey),
  )

  return { localPublicKey, aesKey, nonce }
}

// Encrypt payload with AES-128-GCM
async function encryptPayload(
  payload: string,
  aesKey: Uint8Array,
  nonce: Uint8Array,
  localPublicKey: Uint8Array,
): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const payloadBytes = encoder.encode(payload)

  // Add padding (2-byte padding delimiter + payload, 0 padding bytes)
  const padding = new Uint8Array(2 + payloadBytes.length)
  padding[0] = 0
  padding[1] = 0
  padding.set(payloadBytes, 2)

  const keyObject = await crypto.subtle.importKey(
    'raw',
    aesKey.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  )

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer },
    keyObject,
    new Uint8Array(padding.buffer),
  )

  // Per RFC 8188 section 3.1:
  // salt(16) | record_size(4, uint32 BE) | keyid_length(1, uint8) | keyid(keyid_length bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const recordSize4096 = 4096

  const header = new Uint8Array(16 + 4 + 1 + localPublicKey.length)
  header.set(salt, 0)
  header[16] = (recordSize4096 >> 24) & 0xff
  header[17] = (recordSize4096 >> 16) & 0xff
  header[18] = (recordSize4096 >> 8) & 0xff
  header[19] = recordSize4096 & 0xff
  header[20] = localPublicKey.length
  header.set(localPublicKey, 21)

  return new Uint8Array([...header, ...new Uint8Array(encrypted)])
}

// Convert base64url-encoded raw private key + public key to JWK
function rawKeysToJwk(publicKeyBase64: string, privateKeyBase64: string): JsonWebKey {
  const pubBytes = base64UrlDecode(publicKeyBase64)
  const privBytes = base64UrlDecode(privateKeyBase64)

  // Public key is 65 bytes (0x04 + x + y)
  const x = pubBytes.slice(1, 33)
  const y = pubBytes.slice(33, 65)

  return {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    d: base64UrlEncode(privBytes),
    ext: true,
  }
}

// Parse VAPID private key from various formats
async function importVapidPrivateKey(
  vapidPublicKey: string,
  vapidPrivateKey: string,
): Promise<CryptoKey> {
  const pubLen = vapidPublicKey.length
  const privLen = vapidPrivateKey.length
  const privStart = vapidPrivateKey.length <= 10 ? vapidPrivateKey : vapidPrivateKey.substring(0, 10)

  if (vapidPrivateKey.startsWith('{')) {
    console.log(`[VAPID] Parsing private key as JWK (len=${privLen})`)
    return crypto.subtle.importKey(
      'jwk',
      JSON.parse(vapidPrivateKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
  }

  try {
    console.log(`[VAPID] Parsing as raw base64url keys (pub=${pubLen} priv=${privLen} starts=${privStart}...)`)
    const jwk = rawKeysToJwk(vapidPublicKey, vapidPrivateKey)
    console.log(`[VAPID] JWK built — x=${jwk.x?.length}ch y=${jwk.y?.length}ch d=${jwk.d?.length}ch`)
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
  } catch (e) {
    console.warn(`[VAPID] Raw key parse failed: ${e instanceof Error ? e.message : e}, trying PEM...`)
    if (vapidPrivateKey.includes('-----')) {
      const pemBody = vapidPrivateKey
        .replace(/-----[^-]+-----/g, '')
        .replace(/\s+/g, '')
      const pemBytes = base64UrlDecode(pemBody)

      if (pemBytes.length >= 32) {
        const rawPriv = pemBytes.slice(-32)
        console.log(`[VAPID] PEM parsed — priv raw ${rawPriv.length} bytes`)
        const jwk = rawKeysToJwk(vapidPublicKey, base64UrlEncode(rawPriv))
        return crypto.subtle.importKey(
          'jwk',
          jwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['sign'],
        )
      }
    }
    throw e
  }
}

// Sign VAPID JWT
async function signVapidJwt(
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string,
  audience: string,
): Promise<string> {
  const privateKey = await importVapidPrivateKey(vapidPublicKey, vapidPrivateKey)

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'ES256', typ: 'JWT' }
  const payload = {
    aud: audience,
    exp: now + 43200, // 12 hours
    sub: subject,
  }

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  )

  const sigB64 = base64UrlEncode(new Uint8Array(signature))
  return `${signingInput}.${sigB64}`
}

/**
 * Send a web push notification using native Web Crypto API.
 * Compatible with Cloudflare Workers.
 */
export async function sendWebPush(
  subscription: string,
  title: string,
  body: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
  data?: Record<string, string>,
): Promise<void> {
  let pushSub: { endpoint: string; keys: { p256dh: string; auth: string } }
  try {
    pushSub = JSON.parse(subscription)
  } catch {
    throw new Error('Invalid web push subscription JSON')
  }

  const payload = JSON.stringify({ title, body, data, tag: `chessduo-${data?.type || 'default'}` })

  // Derive encryption keys
  const { localPublicKey, aesKey, nonce } = await derivePushKeys(pushSub.keys)

  // Encrypt payload — pass ephemeral public key so the browser can perform ECDH key agreement
  const encrypted = await encryptPayload(payload, aesKey, nonce, localPublicKey)

  // Sign VAPID JWT
  const audience = new URL(pushSub.endpoint).origin
  const vapidJwt = await signVapidJwt(
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    audience,
  )

  // Build the request
  const keyId = vapidPublicKey
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    'TTL': '86400',
    'Urgency': 'high',
    'Authorization': `vapid t=${vapidJwt}, k=${keyId}`,
  }

  const resp = await fetch(pushSub.endpoint, {
    method: 'POST',
    headers,
    body: encrypted.buffer as ArrayBuffer,
  })

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`Web Push error ${resp.status}: ${errBody}`)
  }
}
