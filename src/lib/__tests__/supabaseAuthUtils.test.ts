import { isCancellationError } from '../supabaseAuthUtils'

describe('supabaseAuthUtils', () => {
  describe('cancellation detection', () => {
    it('returns true for USER_CANCELLED code', () => {
      expect(isCancellationError({ code: 'USER_CANCELLED', message: 'cancelled' })).toBe(true)
    })

    it('returns true for error code 16', () => {
      expect(isCancellationError({ code: 16, message: 'some error' })).toBe(true)
    })

    it('returns true when message contains "Cancelled by user"', () => {
      expect(isCancellationError({ code: '', message: 'GetCredentialCancellationException: [16] Cancelled by user' })).toBe(true)
    })

    it('returns true when message contains GetCredentialCancellationException', () => {
      expect(isCancellationError({ code: '', message: 'GetCredentialCancellationException: something' })).toBe(true)
    })

    it('returns false for other errors', () => {
      expect(isCancellationError({ code: 'NETWORK_ERROR', message: 'connection failed' })).toBe(false)
    })

    it('returns false for empty error', () => {
      expect(isCancellationError({ code: '', message: '' })).toBe(false)
    })
  })
})
