import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import AuthCallbackPage from '../page'

const replaceMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

const exchangeMock = jest.fn()
const authServiceGetSessionMock = jest.fn()
const verifyOtpMock = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeMock(...args),
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    },
  },
}))

jest.mock('@/lib/authService', () => ({
  AuthService: { getSession: (...args: unknown[]) => authServiceGetSessionMock(...args) },
}))

jest.mock('@/lib/authDebug', () => ({
  logAuthDebug: jest.fn(),
  correlationId: () => 'test-correlation',
}))

jest.mock('@/components/PageLoading', () => ({
  PageLoading: ({ label }: { label?: string }) => <div>{label ?? 'Loading'}</div>,
}))

jest.mock('@/hooks/useCapacitorBackButton', () => ({
  useCapacitorBackButton: jest.fn(),
}))

const VERIFIER_MISSING =
  'PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared.'

function setCallbackUrl(query: string) {
  window.history.pushState({}, '', `/auth/callback${query}`)
}

describe('AuthCallbackPage — PKCE race reconciliation', () => {
  beforeEach(() => {
    replaceMock.mockClear()
    exchangeMock.mockReset()
    authServiceGetSessionMock.mockReset()
    verifyOtpMock.mockReset()
    authServiceGetSessionMock.mockResolvedValue(null)
  })

  it('routes home when the explicit code exchange succeeds', async () => {
    setCallbackUrl('?flow=oauth&code=valid-code')
    exchangeMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })

    render(<AuthCallbackPage />)

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'))
  })

  it('routes home when the verifier is gone BUT a session exists (auto-init already exchanged)', async () => {
    // Regression: auth-js auto-initialization (detectSessionInUrl) consumes the
    // one-time code before the explicit exchange runs. The session is the
    // ground truth — sign-in genuinely completed.
    setCallbackUrl('?flow=oauth&code=consumed-code')
    exchangeMock.mockResolvedValue({ data: { session: null }, error: new Error(VERIFIER_MISSING) })
    authServiceGetSessionMock.mockResolvedValue({ user: { id: 'u1' } })

    render(<AuthCallbackPage />)

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'))
    expect(screen.queryByText(/couldn't sign in/i)).toBeNull()
  })

  it('preserves the redirect destination when reconciling via existing session', async () => {
    setCallbackUrl('?flow=oauth&redirect=%2Fcoach%3Flevel%3D3&code=consumed-code')
    exchangeMock.mockResolvedValue({ data: { session: null }, error: new Error(VERIFIER_MISSING) })
    authServiceGetSessionMock.mockResolvedValue({ user: { id: 'u1' } })

    render(<AuthCallbackPage />)

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/?redirect=%2Fcoach%3Flevel%3D3'),
    )
  })

  it('shows the OAuth error screen when verifier is missing AND no session exists', async () => {
    setCallbackUrl('?flow=oauth&code=stale-code')
    exchangeMock.mockResolvedValue({ data: { session: null }, error: new Error(VERIFIER_MISSING) })
    authServiceGetSessionMock.mockResolvedValue(null)

    render(<AuthCallbackPage />)

    expect(await screen.findByText(/couldn't sign in/i)).toBeDefined()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('shows the email recovery screen when verifier is missing AND no session exists (non-OAuth)', async () => {
    setCallbackUrl('?code=other-device-code')
    exchangeMock.mockResolvedValue({ data: { session: null }, error: new Error(VERIFIER_MISSING) })
    authServiceGetSessionMock.mockResolvedValue(null)

    render(<AuthCallbackPage />)

    expect(await screen.findByText(/email confirmed/i)).toBeDefined()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
