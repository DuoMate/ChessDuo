/**
 * Architecture enforcement tests for the Supabase service layer.
 *
 * These tests prevent regression: if someone bypasses the service layer
 * and writes direct Supabase queries, these tests will fail.
 */

import { execSync } from 'child_process'

const SRC_DIR = 'src'

function grep(pattern: string, excludePattern?: string): string[] {
  try {
    const exclude = excludePattern
      ? `--exclude='${excludePattern}'`
      : ''
    const cmd = `grep -rnl "${pattern}" ${SRC_DIR} ${exclude} 2>/dev/null || true`
    return execSync(cmd, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

describe('Supabase Service Layer Architecture', () => {
  describe('Profile upserts must use ProfileService', () => {
    // Allowed files: profileService.ts itself and test files
    const ALLOWED_UPSERT_FILES = [
      'profileService.ts',
      'profileService.test.ts',
    ]

    it('no direct supabase.from("profiles").upsert outside ProfileService', () => {
      const results = grep(`supabase.from.*profiles.*upsert`, '*.test.*')

      const violations = results.filter((file) => {
        return !ALLOWED_UPSERT_FILES.some((allowed) => file.includes(allowed))
      })

      if (violations.length > 0) {
        console.error(
          'PROFILE SERVICE VIOLATION: The following files use direct supabase.from("profiles").upsert() ' +
          'instead of the centralized upsertProfile() from @/lib/profileService:\n' +
          violations.map((f) => `  - ${f}`).join('\n') +
          '\n\nFix: Import { upsertProfile } from "@/lib/profileService" and use it instead.'
        )
      }

      expect(violations).toEqual([])
    })
  })

  describe('Friendship queries must not select non-existent columns', () => {
    const ALLOWED_FRIEND_SELECT_FILES = [
      'friends.ts',
      'friends.test.ts',
    ]

    it('no supabase.from("friendships").select("id") — friendships table has no id column', () => {
      const results = grep(`from.*friendships.*select.*['"]id['"]`, '*.test.*')

      const violations = results.filter((file) => {
        return !ALLOWED_FRIEND_SELECT_FILES.some((allowed) => file.includes(allowed))
      })

      if (violations.length > 0) {
        console.error(
          'FRIENDSHIP QUERY VIOLATION: The following files try to select "id" from the friendships table, ' +
          'which has NO id column (composite key: sender_id + receiver_id):\n' +
          violations.map((f) => `  - ${f}`).join('\n') +
          '\n\nFix: Use getPendingRequestCount from "@/lib/friends" or select sender_id/receiver_id.'
        )
      }

      expect(violations).toEqual([])
    })
  })

  describe('API route auth must use the centralized helper', () => {
    const ALLOWED_API_FILES = [
      'apiAuth.ts',
      'apiAuth.test.ts',
    ]

    it('API routes should not duplicate Bearer/cookie auth logic', () => {
      const results = grep('createServerClient.*cookies', '*.test.*')

      const apiRouteViolations = results.filter((file) => {
        if (!file.includes('src/app/api/')) return false
        return !ALLOWED_API_FILES.some((allowed) => file.includes(allowed))
      })

      if (apiRouteViolations.length > 0) {
        console.warn(
          'API AUTH WARNING: The following API routes still use inline auth logic. ' +
          'Consider migrating to getAuthClient() from @/lib/apiAuth:\n' +
          apiRouteViolations.map((f) => `  - ${f}`).join('\n')
        )
      }

      expect(apiRouteViolations.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Supabase client singleton still works', () => {
    it('supabase.ts exists and exports supabase client', () => {
      const content = execSync(`grep -c "export const supabase" ${SRC_DIR}/lib/supabase.ts`, { encoding: 'utf8' }).trim()
      expect(Number(content)).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Service files exist and are importable', () => {
    const requiredServiceFiles = [
      'src/lib/profileService.ts',
      'src/lib/apiAuth.ts',
      'src/lib/supabaseTypes.ts',
    ]

    requiredServiceFiles.forEach((file) => {
      it(`${file} exists`, () => {
        const result = execSync(`test -f ${file} && echo "exists" || echo "missing"`, { encoding: 'utf8' }).trim()
        expect(result).toBe('exists')
      })
    })
  })
})
