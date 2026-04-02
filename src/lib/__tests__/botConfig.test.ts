import {
  getBotConfig,
  createBotConfig,
  getSkillLevelDescription,
  getAvailableSkillLevels,
  BotSkillConfig,
  SkillLevel,
} from '../botConfig'

describe('Bot Configuration Module', () => {
  // Store original env variables
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('getBotConfig', () => {
    test('returns default configuration when no env vars are set', () => {
      delete process.env.BOT_OPPONENT_SKILL_LEVEL
      delete process.env.BOT_TEAMMATE_SKILL_LEVEL

      const config = getBotConfig()

      expect(config).toEqual({
        opponentSkillLevel: 4, // 1800 ELO
        teammateSkillLevel: 4, // 1800 ELO
      })
    })

    test('defaults to 1800 ELO (level 4) for both bots', () => {
      delete process.env.BOT_OPPONENT_SKILL_LEVEL
      delete process.env.BOT_TEAMMATE_SKILL_LEVEL

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('reads BOT_OPPONENT_SKILL_LEVEL from environment', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '5'
      delete process.env.BOT_TEAMMATE_SKILL_LEVEL

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(5)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('reads BOT_TEAMMATE_SKILL_LEVEL from environment', () => {
      delete process.env.BOT_OPPONENT_SKILL_LEVEL
      process.env.BOT_TEAMMATE_SKILL_LEVEL = '3'

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(3)
    })

    test('reads both skill levels from environment variables', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '6'
      process.env.BOT_TEAMMATE_SKILL_LEVEL = '1'

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(6)
      expect(config.teammateSkillLevel).toBe(1)
    })

    test('accepts all valid skill levels (1-6)', () => {
      for (let level = 1; level <= 6; level++) {
        process.env.BOT_OPPONENT_SKILL_LEVEL = String(level)
        process.env.BOT_TEAMMATE_SKILL_LEVEL = String(level)

        const config = getBotConfig()

        expect(config.opponentSkillLevel).toBe(level)
        expect(config.teammateSkillLevel).toBe(level)
      }
    })

    test('returns BotSkillConfig type', () => {
      const config = getBotConfig()

      expect(config).toHaveProperty('opponentSkillLevel')
      expect(config).toHaveProperty('teammateSkillLevel')
      expect(typeof config.opponentSkillLevel).toBe('number')
      expect(typeof config.teammateSkillLevel).toBe('number')
    })
  })

  describe('Invalid Environment Variable Handling', () => {
    test('falls back to default when skill level is below 1', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '0'
      process.env.BOT_TEAMMATE_SKILL_LEVEL = '-5'

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('falls back to default when skill level exceeds 6', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '7'
      process.env.BOT_TEAMMATE_SKILL_LEVEL = '100'

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('falls back to default when value is not a number', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = 'invalid'
      process.env.BOT_TEAMMATE_SKILL_LEVEL = 'abc'

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('falls back to default for empty string', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = ''
      process.env.BOT_TEAMMATE_SKILL_LEVEL = ''

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('falls back to default for decimal values', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '4.5'
      process.env.BOT_TEAMMATE_SKILL_LEVEL = '3.2'

      const config = getBotConfig()

      // parseInt will convert 4.5 to 4, 3.2 to 3
      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(3)
    })

    test('handles whitespace in env variables', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '  4  '
      process.env.BOT_TEAMMATE_SKILL_LEVEL = '5'

      const config = getBotConfig()

      // parseInt ignores leading/trailing whitespace
      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(5)
    })
  })

  describe('getSkillLevelDescription', () => {
    test('returns correct description for skill level 1', () => {
      expect(getSkillLevelDescription(1)).toBe('~1500 ELO')
    })

    test('returns correct description for skill level 2', () => {
      expect(getSkillLevelDescription(2)).toBe('~1600 ELO')
    })

    test('returns correct description for skill level 3', () => {
      expect(getSkillLevelDescription(3)).toBe('~1700 ELO')
    })

    test('returns correct description for skill level 4 (default)', () => {
      expect(getSkillLevelDescription(4)).toBe('~1800 ELO')
    })

    test('returns correct description for skill level 5', () => {
      expect(getSkillLevelDescription(5)).toBe('~1900 ELO')
    })

    test('returns correct description for skill level 6', () => {
      expect(getSkillLevelDescription(6)).toBe('~2000+ ELO')
    })

    test('returns "Unknown" for invalid skill level', () => {
      expect(getSkillLevelDescription(0)).toBe('Unknown')
      expect(getSkillLevelDescription(7)).toBe('Unknown')
      expect(getSkillLevelDescription(-1)).toBe('Unknown')
    })

    test('all valid levels have descriptions', () => {
      for (let level = 1; level <= 6; level++) {
        const description = getSkillLevelDescription(level)
        expect(description).not.toBe('Unknown')
        expect(description).toMatch(/~\d+\+? ELO/)
      }
    })
  })

  describe('getAvailableSkillLevels', () => {
    test('returns array of skill levels', () => {
      const levels = getAvailableSkillLevels()

      expect(Array.isArray(levels)).toBe(true)
      expect(levels.length).toBe(6)
    })

    test('each skill level has required properties', () => {
      const levels = getAvailableSkillLevels()

      levels.forEach((skillLevel) => {
        expect(skillLevel).toHaveProperty('level')
        expect(skillLevel).toHaveProperty('description')
        expect(skillLevel).toHaveProperty('label')
      })
    })

    test('skill levels are in correct order', () => {
      const levels = getAvailableSkillLevels()

      for (let i = 0; i < levels.length; i++) {
        expect(levels[i].level).toBe(i + 1)
      }
    })

    test('includes all ELO ranges', () => {
      const levels = getAvailableSkillLevels()
      const descriptions = levels.map((l) => l.description)

      expect(descriptions).toContain('~1500 ELO')
      expect(descriptions).toContain('~1600 ELO')
      expect(descriptions).toContain('~1700 ELO')
      expect(descriptions).toContain('~1800 ELO')
      expect(descriptions).toContain('~1900 ELO')
      expect(descriptions).toContain('~2000+ ELO')
    })

    test('includes difficulty labels', () => {
      const levels = getAvailableSkillLevels()
      const labels = levels.map((l) => l.label)

      expect(labels).toContain('Beginner')
      expect(labels).toContain('Novice')
      expect(labels).toContain('Intermediate')
      expect(labels).toContain('Advanced')
      expect(labels).toContain('Expert')
      expect(labels).toContain('Master')
    })

    test('skill level 4 (default) is Advanced', () => {
      const levels = getAvailableSkillLevels()
      const level4 = levels.find((l) => l.level === 4)

      expect(level4).toBeDefined()
      expect(level4?.description).toBe('~1800 ELO')
      expect(level4?.label).toBe('Advanced')
    })

    test('return value is immutable for consumer', () => {
      const levels = getAvailableSkillLevels()
      const originalLength = levels.length

      // Try to modify the returned array
      levels.push({ level: 7, description: '~2100 ELO', label: 'Ultra' })

      // Call function again
      const levelsAgain = getAvailableSkillLevels()

      expect(levelsAgain.length).toBe(originalLength)
    })
  })

  describe('Configuration Integration', () => {
    test('default configuration matches Advanced (1800 ELO)', () => {
      delete process.env.BOT_OPPONENT_SKILL_LEVEL
      delete process.env.BOT_TEAMMATE_SKILL_LEVEL

      const config = getBotConfig()
      const description = getSkillLevelDescription(config.opponentSkillLevel)

      expect(description).toBe('~1800 ELO')
    })

    test('can get description for configured skill level', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '5'

      const config = getBotConfig()
      const description = getSkillLevelDescription(config.opponentSkillLevel)

      expect(description).toBe('~1900 ELO')
    })

    test('can get all available levels and use them for config', () => {
      const levels = getAvailableSkillLevels()

      levels.forEach(({ level }) => {
        process.env.BOT_OPPONENT_SKILL_LEVEL = String(level)

        const config = getBotConfig()

        expect(config.opponentSkillLevel).toBe(level)
      })
    })
  })

  describe('Use Case: Static 1800 ELO Configuration', () => {
    test('both bots default to 1800 ELO without env vars', () => {
      delete process.env.BOT_OPPONENT_SKILL_LEVEL
      delete process.env.BOT_TEAMMATE_SKILL_LEVEL

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
      expect(getSkillLevelDescription(config.opponentSkillLevel)).toBe('~1800 ELO')
      expect(getSkillLevelDescription(config.teammateSkillLevel)).toBe('~1800 ELO')
    })

    test('can override both bots to 1800 ELO via env vars', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '4'
      process.env.BOT_TEAMMATE_SKILL_LEVEL = '4'

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('both bots can be set to same skill level independently', () => {
      const testLevels = [1, 2, 3, 4, 5, 6]

      testLevels.forEach((testLevel) => {
        process.env.BOT_OPPONENT_SKILL_LEVEL = String(testLevel)
        process.env.BOT_TEAMMATE_SKILL_LEVEL = String(testLevel)

        const config = getBotConfig()

        expect(config.opponentSkillLevel).toBe(testLevel)
        expect(config.teammateSkillLevel).toBe(testLevel)
      })
    })

    test('bots can have different skill levels when configured', () => {
      process.env.BOT_OPPONENT_SKILL_LEVEL = '3'
      process.env.BOT_TEAMMATE_SKILL_LEVEL = '5'

      const config = getBotConfig()

      expect(config.opponentSkillLevel).toBe(3)
      expect(config.teammateSkillLevel).toBe(5)
      expect(config.opponentSkillLevel).not.toBe(config.teammateSkillLevel)
    })
  })

  describe('createBotConfig', () => {
    test('creates config with specified skill levels', () => {
      const config = createBotConfig(3, 5)

      expect(config.opponentSkillLevel).toBe(3)
      expect(config.teammateSkillLevel).toBe(5)
    })

    test('accepts all valid skill levels (1-6)', () => {
      for (let level = 1; level <= 6; level++) {
        const config = createBotConfig(level, level)

        expect(config.opponentSkillLevel).toBe(level)
        expect(config.teammateSkillLevel).toBe(level)
      }
    })

    test('clamps skill level below 1 to 4 (default)', () => {
      const config = createBotConfig(0, -5)

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('clamps skill level above 6 to 4 (default)', () => {
      const config = createBotConfig(7, 100)

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('clamps NaN to default level 4', () => {
      const config = createBotConfig(NaN, NaN)

      expect(config.opponentSkillLevel).toBe(4)
      expect(config.teammateSkillLevel).toBe(4)
    })

    test('handles decimal values by rounding', () => {
      const config = createBotConfig(4.9, 1.1)

      expect(config.opponentSkillLevel).toBe(5)
      expect(config.teammateSkillLevel).toBe(1)
    })

    test('allows different levels for opponent and teammate', () => {
      const config = createBotConfig(2, 5)

      expect(config.opponentSkillLevel).toBe(2)
      expect(config.teammateSkillLevel).toBe(5)
    })

    test('returns BotSkillConfig type', () => {
      const config = createBotConfig(3, 4)

      expect(config).toHaveProperty('opponentSkillLevel')
      expect(config).toHaveProperty('teammateSkillLevel')
      expect(typeof config.opponentSkillLevel).toBe('number')
      expect(typeof config.teammateSkillLevel).toBe('number')
    })

    test('works with all ELO levels from getAvailableSkillLevels', () => {
      const levels = getAvailableSkillLevels()

      levels.forEach(({ level }) => {
        const config = createBotConfig(level, level)

        expect(config.opponentSkillLevel).toBe(level)
        expect(config.teammateSkillLevel).toBe(level)
      })
    })
  })
})
