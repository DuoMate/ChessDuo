import { validateUsernameFormat } from '../../components/Auth'
import { sanitizeDisplayName } from '../../components/ChooseUsername'

describe('validateUsernameFormat', () => {
  test('accepts valid usernames', () => {
    expect(validateUsernameFormat('player1')).toBeNull()
    expect(validateUsernameFormat('Knight_Rider')).toBeNull()
    expect(validateUsernameFormat('abc')).toBeNull()
    expect(validateUsernameFormat('a_b_c')).toBeNull()
    expect(validateUsernameFormat('Test123')).toBeNull()
    expect(validateUsernameFormat('a'.repeat(30))).toBeNull()
  })

  test('rejects empty or whitespace-only usernames', () => {
    expect(validateUsernameFormat('')).not.toBeNull()
    expect(validateUsernameFormat('   ')).not.toBeNull()
  })

  test('rejects usernames shorter than 3 characters', () => {
    expect(validateUsernameFormat('ab')).not.toBeNull()
    expect(validateUsernameFormat('a')).not.toBeNull()
  })

  test('rejects usernames longer than 30 characters', () => {
    expect(validateUsernameFormat('a'.repeat(31))).not.toBeNull()
  })

  test('rejects usernames with special characters', () => {
    expect(validateUsernameFormat('player-1')).not.toBeNull()
    expect(validateUsernameFormat('player 1')).not.toBeNull()
    expect(validateUsernameFormat('player@1')).not.toBeNull()
    expect(validateUsernameFormat('player!')).not.toBeNull()
    expect(validateUsernameFormat('hello.world')).not.toBeNull()
  })

  test('rejects reserved usernames (case-insensitive)', () => {
    expect(validateUsernameFormat('admin')).not.toBeNull()
    expect(validateUsernameFormat('Admin')).not.toBeNull()
    expect(validateUsernameFormat('ADMIN')).not.toBeNull()
    expect(validateUsernameFormat('moderator')).not.toBeNull()
    expect(validateUsernameFormat('system')).not.toBeNull()
    expect(validateUsernameFormat('chessduo')).not.toBeNull()
    expect(validateUsernameFormat('support')).not.toBeNull()
    expect(validateUsernameFormat('bot')).not.toBeNull()
    expect(validateUsernameFormat('null')).not.toBeNull()
    expect(validateUsernameFormat('undefined')).not.toBeNull()
    expect(validateUsernameFormat('root')).not.toBeNull()
    expect(validateUsernameFormat('developer')).not.toBeNull()
  })

  test('accepts usernames that contain reserved words as substrings', () => {
    expect(validateUsernameFormat('admin_player')).toBeNull()
    expect(validateUsernameFormat('notabot')).toBeNull()
    expect(validateUsernameFormat('system_check')).toBeNull()
  })
})

describe('sanitizeDisplayName', () => {
  test('converts to lowercase', () => {
    expect(sanitizeDisplayName('JohnDoe')).toBe('johndoe')
  })

  test('replaces spaces with underscores', () => {
    expect(sanitizeDisplayName('John Doe')).toBe('john_doe')
  })

  test('strips special characters', () => {
    expect(sanitizeDisplayName('John@Doe!')).toBe('john_doe')
  })

  test('collapses multiple underscores', () => {
    expect(sanitizeDisplayName('John   Doe')).toBe('john_doe')
  })

  test('trims leading and trailing underscores', () => {
    expect(sanitizeDisplayName(' John ')).toBe('john')
    expect(sanitizeDisplayName('@John@')).toBe('john')
  })

  test('truncates to 30 characters', () => {
    const long = 'a'.repeat(50)
    expect(sanitizeDisplayName(long).length).toBeLessThanOrEqual(30)
  })

  test('handles empty string', () => {
    expect(sanitizeDisplayName('')).toBe('')
  })

  test('handles names with only special characters', () => {
    expect(sanitizeDisplayName('@#$%')).toBe('')
  })

  test('handles typical Google display names', () => {
    expect(sanitizeDisplayName('John Smith')).toBe('john_smith')
    expect(sanitizeDisplayName('María García')).toBe('mar_a_garc_a')
    expect(sanitizeDisplayName('O\'Brien')).toBe('o_brien')
  })
})
