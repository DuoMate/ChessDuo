/**
 * Bot Configuration Module
 * Manages bot skill levels through environment variables with sensible defaults
 */

export interface SkillLevel {
  level: number
  description: string
  label: string
}

export interface BotSkillConfig {
  /**
   * Opponent bot skill level (1-6)
   * Determines the difficulty of the opponent bot
   */
  opponentSkillLevel: number

  /**
   * Teammate bot skill level (1-6)
   * Determines the skill of your teammate bot
   */
  teammateSkillLevel: number
}

/**
 * Get bot configuration from environment variables
 * Falls back to default values if not set
 *
 * Environment variables:
 * - BOT_OPPONENT_SKILL_LEVEL: Opponent bot skill level (default: 4 = 1800 ELO)
 * - BOT_TEAMMATE_SKILL_LEVEL: Teammate bot skill level (default: 4 = 1800 ELO)
 *
 * Skill levels correspond to:
 * 1: ~1500 ELO (bestMoveChance: 30%)
 * 2: ~1600 ELO (bestMoveChance: 45%)
 * 3: ~1700 ELO (bestMoveChance: 60%)
 * 4: ~1800 ELO (bestMoveChance: 75%)
 * 5: ~1900 ELO (bestMoveChance: 85%)
 * 6: ~2000+ ELO (bestMoveChance: 95%)
 */
export function getBotConfig(): BotSkillConfig {
  // Parse from environment or use defaults (both bots default to 1800 ELO / level 4)
  const opponentSkillLevel = parseBotSkillLevel(
    process.env.BOT_OPPONENT_SKILL_LEVEL,
    4, // default: 1800 ELO
    'BOT_OPPONENT_SKILL_LEVEL'
  )

  const teammateSkillLevel = parseBotSkillLevel(
    process.env.BOT_TEAMMATE_SKILL_LEVEL,
    4, // default: 1800 ELO
    'BOT_TEAMMATE_SKILL_LEVEL'
  )

  return {
    opponentSkillLevel,
    teammateSkillLevel,
  }
}

/**
 * Create bot configuration with specified skill levels
 * Validates and clamps skill levels to valid range (1-6)
 * @param opponentSkillLevel - Opponent bot skill level (1-6)
 * @param teammateSkillLevel - Teammate bot skill level (1-6)
 * @returns BotSkillConfig with validated skill levels
 */
export function createBotConfig(
  opponentSkillLevel: number,
  teammateSkillLevel: number
): BotSkillConfig {
  const validateLevel = (level: number, defaultLevel: number): number => {
    if (isNaN(level)) {
      return defaultLevel
    }
    const rounded = Math.round(level)
    if (rounded < 1 || rounded > 6) {
      return defaultLevel
    }
    return rounded
  }

  return {
    opponentSkillLevel: validateLevel(opponentSkillLevel, 4),
    teammateSkillLevel: validateLevel(teammateSkillLevel, 4),
  }
}

/**
 * Parse and validate a bot skill level from environment variable
 * @param value - Environment variable value
 * @param defaultValue - Fallback value if not set
 * @param varName - Variable name for logging
 * @returns Validated skill level (1-6)
 */
function parseBotSkillLevel(
  value: string | undefined,
  defaultValue: number,
  varName: string
): number {
  if (!value) {
    return defaultValue
  }

  const parsed = parseInt(value, 10)

  // Validate range
  if (isNaN(parsed) || parsed < 1 || parsed > 6) {
    console.warn(
      `Invalid ${varName}="${value}". Must be between 1 and 6. Using default: ${defaultValue}`
    )
    return defaultValue
  }

  return parsed
}

/**
 * Get human-readable skill level description
 * @param skillLevel - Skill level (1-6)
 * @returns Description like "~1800 ELO"
 */
export function getSkillLevelDescription(skillLevel: number): string {
  const descriptions: Record<number, string> = {
    1: '~1500 ELO',
    2: '~1600 ELO',
    3: '~1700 ELO',
    4: '~1800 ELO',
    5: '~1900 ELO',
    6: '~2000+ ELO',
  }

  return descriptions[skillLevel] || 'Unknown'
}

/**
 * Get all available skill levels with descriptions
 * Useful for UI components that let users select skill levels
 */
export function getAvailableSkillLevels(): SkillLevel[] {
  return [
    { level: 1, description: '~1500 ELO', label: 'Beginner' },
    { level: 2, description: '~1600 ELO', label: 'Novice' },
    { level: 3, description: '~1700 ELO', label: 'Intermediate' },
    { level: 4, description: '~1800 ELO', label: 'Advanced' },
    { level: 5, description: '~1900 ELO', label: 'Expert' },
    { level: 6, description: '~2000+ ELO', label: 'Master' },
  ]
}
