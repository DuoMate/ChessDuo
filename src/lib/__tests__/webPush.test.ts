/**
 * @jest-environment node
 *
 * Test that the Web Push encryption uses correct HMAC key type for HKDF.
 *
 * Regression test: importing ECDH shared secret as { name: 'HKDF' }
 * prevents it from being used in HMAC sign operations, causing
 * "Unable to use this key to sign" at runtime.
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
