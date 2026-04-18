export interface DifficultyConfig {
  elo: number
  depth: number
  topMoves: number
  noise: number
  weights: number[]
  blunderChance: number
  weirdChance: number
  maxDrop: number
}

export const DIFFICULTY: Record<number, DifficultyConfig> = {
  1: {
    elo: 1000,
    depth: 5,
    topMoves: 10,
    noise: 150,
    weights: [0.35, 0.25, 0.2, 0.1, 0.05, 0.03, 0.01, 0.005, 0.002, 0.001],
    blunderChance: 0.2,
    weirdChance: 0.5,
    maxDrop: 500
  },
  2: {
    elo: 1500,
    depth: 7,
    topMoves: 8,
    noise: 100,
    weights: [0.4, 0.25, 0.2, 0.1, 0.03, 0.01, 0.005, 0.002],
    blunderChance: 0.12,
    weirdChance: 0.35,
    maxDrop: 350
  },
  3: {
    elo: 1800,
    depth: 10,
    topMoves: 6,
    noise: 60,
    weights: [0.45, 0.3, 0.15, 0.07, 0.02, 0.01],
    blunderChance: 0.06,
    weirdChance: 0.2,
    maxDrop: 200
  },
  4: {
    elo: 2000,
    depth: 12,
    topMoves: 4,
    noise: 35,
    weights: [0.5, 0.3, 0.15, 0.05],
    blunderChance: 0.03,
    weirdChance: 0.12,
    maxDrop: 150
  },
  5: {
    elo: 2200,
    depth: 15,
    topMoves: 3,
    noise: 15,
    weights: [0.6, 0.3, 0.1],
    blunderChance: 0.01,
    weirdChance: 0.05,
    maxDrop: 80
  },
  6: {
    elo: 2600,
    depth: 18,
    topMoves: 6,
    noise: 5,
    weights: [0.30, 0.25, 0.20, 0.15, 0.08, 0.02],
    blunderChance: 0.0,
    weirdChance: 0.02,
    maxDrop: 60
  }
}

export const DESCRIPTIONS: Record<number, string> = {
  1: 'Beginner ~1000 ELO',
  2: 'Novice ~1500 ELO',
  3: 'Intermediate ~1800 ELO',
  4: 'Advanced ~2000 ELO',
  5: 'Expert ~2200 ELO',
  6: 'Master ~2600 ELO'
}
