export const SocialLogin = {
  async initialize(): Promise<void> {},
  async login(): Promise<{ provider: string; result: null }> {
    return { provider: 'google', result: null }
  },
  async logout(): Promise<void> {},
  async isLoggedIn(): Promise<{ isLoggedIn: boolean }> {
    return { isLoggedIn: false }
  },
}
