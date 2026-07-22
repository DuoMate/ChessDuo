/**
 * Architecture enforcement tests for the service layer.
 * Prevents regression: if someone bypasses the service layer,
 * these tests will fail.
 */

import { execSync } from 'child_process'

const SRC_DIR = 'src'

function grep(pattern: string, excludePattern?: string): string[] {
  try {
    const exclude = excludePattern
      ? `--exclude='${excludePattern}'`
      : ''
    const dir = `--exclude-dir='__tests__'`
    const cmd = `grep -rnl "${pattern}" ${SRC_DIR} ${dir} ${exclude} 2>/dev/null || true`
    return execSync(cmd, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

const ALLOWED_SESSION_FILES = ['authService.ts', 'apiAuth.ts']
const ALLOWED_ONAUTH_FILES = ['authService.ts']

describe('Architecture Enforcement', () => {
  describe('Auth calls must use AuthService', () => {
    it('no direct supabase.auth.getSession() outside authService', () => {
      const results = grep('supabase\\.auth\\.getSession')
      const violations = results.filter((file) => {
        return !ALLOWED_SESSION_FILES.some((allowed) => file.includes(allowed))
      })
      if (violations.length > 0) {
        console.error(
          'AUTH VIOLATION: Direct supabase.auth.getSession() found in:\n' +
          violations.map((f) => `  - ${f}`).join('\n') +
          '\n\nFix: Import { AuthService } from "@/lib/authService" and use AuthService.getSession() instead.'
        )
      }
      expect(violations).toEqual([])
    })

    it('no direct supabase.auth.onAuthStateChange outside authService', () => {
      const results = grep('supabase\\.auth\\.onAuthStateChange')
      const violations = results.filter((file) => {
        return !ALLOWED_ONAUTH_FILES.some((allowed) => file.includes(allowed))
      })
      if (violations.length > 0) {
        console.error(
          'AUTH VIOLATION: Direct supabase.auth.onAuthStateChange() found in:\n' +
          violations.map((f) => `  - ${f}`).join('\n') +
          '\n\nFix: Import { AuthService } from "@/lib/authService" and use AuthService.onAuthChange() instead.'
        )
      }
      expect(violations).toEqual([])
    })
  })

  describe('Empty catch blocks must have comments', () => {
    it('no empty catch {} without a comment', () => {
      const results = grep('catch \\{}')
      if (results.length > 0) {
        console.error(
          'CATCH VIOLATION: Empty catch {} blocks found in:\n' +
          results.map((f) => `  - ${f}`).join('\n') +
          '\n\nFix: Add a comment explaining why silence is acceptable.'
        )
      }
      expect(results).toEqual([])
    })
  })

  describe('Realtime channels use RealtimeService', () => {
    it('no direct supabase.channel() outside allowed files', () => {
      const directChannels = grep('supabase\\.channel\\(')
      const allowedFiles = ['realtimeService.ts', 'realtimeService.test.ts', 'subscriptionManager.ts',
        'onlineGame.ts', 'duelGame.ts', 'messages.ts', 'useBadgeCount.ts',
        'FriendsPanel.tsx']
      const violations = directChannels.filter((file) => {
        return !allowedFiles.some((allowed) => file.includes(allowed))
      })
      if (violations.length > 0) {
        console.error(
          'REALTIME VIOLATION: Direct supabase.channel() calls in:\n' +
          violations.map((f) => `  - ${f}`).join('\n') +
          '\n\nFix: Use RealtimeService.subscribeToTable() or register via subscriptionManager.'
        )
      }
      expect(violations).toEqual([])
    })
  })
})
