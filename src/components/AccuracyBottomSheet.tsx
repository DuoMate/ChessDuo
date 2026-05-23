'use client'

import { motion } from 'framer-motion'
import { MoveComparison } from '@/features/offline/game/localGame'
import { InsightsGate } from './InsightsGate'

interface AccuracyBottomSheetProps {
  comparison: MoveComparison | null
  isVisible: boolean
  playerId?: string | null
  player1Id?: string | null
}

function getPositionLabel(score: number): { label: string; color: string; bg: string } {
  if (score < -300) return { label: 'Black is winning', color: '#1e1e1e', bg: 'bg-gray-900/60' }
  if (score < -100) return { label: 'Black has an advantage', color: '#9ca3af', bg: 'bg-gray-800/60' }
  if (score <= 100) return { label: 'Position is balanced', color: '#6b7280', bg: 'bg-gray-800/40' }
  if (score <= 300) return { label: 'White has an advantage', color: '#e5e7eb', bg: 'bg-gray-700/60' }
  return { label: 'White is winning', color: '#ffffff', bg: 'bg-white/10' }
}

function getEvalBarPercent(score: number): number {
  const clamped = Math.max(-500, Math.min(500, score))
  return ((clamped + 500) / 1000) * 100
}

function getMoveImpact(move: string): string {
  if (move.includes('#')) return 'Checkmate!'
  if (move.includes('+')) return 'Puts king in check'
  if (move.includes('O-O-O')) return 'Queenside castling — king is safer'
  if (move.includes('O-O')) return 'Kingside castling — king is safer'
  if (move.includes('x')) return 'Captured a piece'
  if (move.includes('=')) return 'Promoted a pawn'
  return ''
}

function getBlunderWarning(loss: number): { emoji: string; label: string; color: string } | null {
  if (loss >= 500) return { emoji: '\u274C', label: 'Critical blunder — lost a piece!', color: '#ef4444' }
  if (loss >= 200) return { emoji: '\u26A0\uFE0F', label: 'Blunder — costly mistake', color: '#f59e0b' }
  if (loss >= 100) return { emoji: '\u2757', label: 'Inaccuracy — missed a better move', color: '#eab308' }
  return null
}

export function AccuracyBottomSheet({ comparison, isVisible, playerId, player1Id }: AccuracyBottomSheetProps) {
  const isPlayer1 = playerId && player1Id ? playerId === player1Id : true

  const youWon = (isPlayer1 && comparison?.winnerId === 'player1') ||
                 (!isPlayer1 && comparison?.winnerId === 'player2')

  const yourAccuracy = isPlayer1 ? (comparison?.player1Accuracy ?? 0) : (comparison?.player2Accuracy ?? 0)
  const teammateAccuracy = isPlayer1 ? (comparison?.player2Accuracy ?? 0) : (comparison?.player1Accuracy ?? 0)
  const yourMove = isPlayer1 ? comparison?.player1Move : comparison?.player2Move
  const teammateMove = isPlayer1 ? comparison?.player2Move : comparison?.player1Move
  const yourCategory = isPlayer1
    ? (comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' })
    : (comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' })
  const teammateCategory = isPlayer1
    ? (comparison?.player2Category ?? { label: '', color: 'gray', emoji: '' })
    : (comparison?.player1Category ?? { label: '', color: 'gray', emoji: '' })
  const yourLoss = isPlayer1 ? (comparison?.player1Loss ?? 0) : (comparison?.player2Loss ?? 0)
  const teammateLoss = isPlayer1 ? (comparison?.player2Loss ?? 0) : (comparison?.player1Loss ?? 0)
  const youMatchedEngine = isPlayer1 ? (comparison?.youMatchedEngine ?? false) : (comparison?.teammateMatchedEngine ?? false)
  const teammateMatchedEngine = isPlayer1 ? (comparison?.teammateMatchedEngine ?? false) : (comparison?.youMatchedEngine ?? false)

  const humanWon = youWon

  if (!isVisible || !comparison) return null

  const storedIsSync = comparison.isSync ?? false
  const computedIsSync = comparison.player1Move === comparison.player2Move
  const isSync = storedIsSync !== computedIsSync ? computedIsSync : storedIsSync

  const posLabel = getPositionLabel(comparison.bestEngineScore)
  const evalBarPct = getEvalBarPercent(comparison.bestEngineScore)
  const yourMoveImpact = getMoveImpact(yourMove ?? '')
  const teammateMoveImpact = getMoveImpact(teammateMove ?? '')
  const yourBlunder = getBlunderWarning(yourLoss)
  const mateBlunder = getBlunderWarning(teammateLoss)
  const alternatives = comparison.alternatives?.slice(0, 4) ?? []
  const bothMatched = youMatchedEngine && teammateMatchedEngine

  return (
    <motion.div
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
      className="w-full max-w-[500px] mx-auto"
    >
      <div className="flex justify-center mb-2">
        <div className="w-10 md:w-12 h-1 md:h-1.5 bg-gray-600 rounded-full" />
      </div>

      <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl p-3 md:p-4 shadow-2xl border border-gray-600">

        {/* Header */}
        <div className="text-center mb-3 md:mb-4">
          <motion.h3
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, delay: 0.1 }}
            className="text-yellow-400 font-bold text-base md:text-lg uppercase tracking-wide"
          >
            {isSync ? '\uD83C\uDFAF Synchronized!' : humanWon ? '\uD83C\uDF89 You Won This Turn!' : '\uD83D\uDCAA Teammate Won!'}
          </motion.h3>
        </div>

        {/* Position Evaluation Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="mb-3 md:mb-4"
        >
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-[10px] md:text-xs text-gray-500 min-w-[40px] md:min-w-[50px] text-right">Black</span>
            <div className="flex-1 h-2.5 md:h-3 bg-gradient-to-r from-gray-900 via-gray-600 to-white rounded-full overflow-hidden relative">
              <motion.div
                className="absolute top-0 h-full w-0.5 md:w-1 bg-yellow-400 rounded"
                initial={{ left: '50%' }}
                animate={{ left: `${evalBarPct}%` }}
                transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] md:text-xs text-gray-500 min-w-[40px] md:min-w-[50px]">White</span>
          </div>
          <div className="flex items-center justify-center gap-1 md:gap-1.5 mt-1 md:mt-1.5">
            <span
              className="text-[10px] md:text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${posLabel.color}20`, color: posLabel.color }}
            >
              {posLabel.label}
            </span>
          </div>
        </motion.div>

        {/* Player Rows */}
        <div className="space-y-2 md:space-y-3">
          {/* You */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`flex items-center justify-between p-2.5 md:p-3 rounded-xl ${
              humanWon && !isSync ? 'bg-green-900/40 border border-green-500/50'
                : !humanWon && !isSync ? 'bg-red-900/40 border border-red-500/50'
                : 'bg-gray-700/50'
            }`}
          >
            <div className="flex flex-col min-w-0 flex-1 mr-2">
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <span className="text-white font-bold text-xs md:text-sm">You</span>
                {humanWon && !isSync && (
                  <span className="text-[10px] md:text-xs bg-green-500 text-white px-1.5 md:px-2 py-0.5 rounded-full font-bold">WINNER</span>
                )}
                {!humanWon && !isSync && (
                  <span className="text-[10px] md:text-xs bg-red-500 text-white px-1.5 md:px-2 py-0.5 rounded-full font-bold">LOSER</span>
                )}
                {youMatchedEngine && (
                  <span className="text-[10px] md:text-xs bg-yellow-500/20 text-yellow-400 px-1.5 md:px-2 py-0.5 rounded-full font-medium">\uD83C\uDFAF Engine pick</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
                <span className="text-gray-300 text-xs md:text-sm font-mono">{yourMove}</span>
                <span
                  className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded font-medium whitespace-nowrap"
                  style={{ backgroundColor: `${yourCategory.color}30`, color: yourCategory.color }}
                >
                  {yourCategory.emoji} {yourCategory.label}
                </span>
              </div>
              {yourMoveImpact && (
                <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">{yourMoveImpact}</p>
              )}
              {yourBlunder && (
                <p className="text-[10px] md:text-xs mt-0.5 font-medium" style={{ color: yourBlunder.color }}>
                  {yourBlunder.emoji} {yourBlunder.label}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <div className="w-12 md:w-20 h-1.5 md:h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: yourAccuracy >= 90 ? '#22c55e' : yourAccuracy >= 70 ? '#eab308' : '#ef4444' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${yourAccuracy}%` }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                />
              </div>
              <span className={`font-bold text-sm md:text-xl ${humanWon ? 'text-green-400' : 'text-gray-400'}`}>
                {yourAccuracy.toFixed(0)}%
              </span>
            </div>
          </motion.div>

          {/* Teammate */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`flex items-center justify-between p-2.5 md:p-3 rounded-xl ${
              !humanWon && !isSync ? 'bg-green-900/40 border border-green-500/50'
                : humanWon && !isSync ? 'bg-red-900/40 border border-red-500/50'
                : 'bg-gray-700/50'
            }`}
          >
            <div className="flex flex-col min-w-0 flex-1 mr-2">
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <span className="text-gray-300 font-bold text-xs md:text-sm">Teammate</span>
                {!humanWon && !isSync && (
                  <span className="text-[10px] md:text-xs bg-green-500 text-white px-1.5 md:px-2 py-0.5 rounded-full font-bold">WINNER</span>
                )}
                {humanWon && !isSync && (
                  <span className="text-[10px] md:text-xs bg-red-500 text-white px-1.5 md:px-2 py-0.5 rounded-full font-bold">LOSER</span>
                )}
                {teammateMatchedEngine && (
                  <span className="text-[10px] md:text-xs bg-yellow-500/20 text-yellow-400 px-1.5 md:px-2 py-0.5 rounded-full font-medium">\uD83C\uDFAF Engine pick</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
                <span className="text-gray-300 text-xs md:text-sm font-mono">{teammateMove}</span>
                <span
                  className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded font-medium whitespace-nowrap"
                  style={{ backgroundColor: `${teammateCategory.color}30`, color: teammateCategory.color }}
                >
                  {teammateCategory.emoji} {teammateCategory.label}
                </span>
              </div>
              {teammateMoveImpact && (
                <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">{teammateMoveImpact}</p>
              )}
              {mateBlunder && (
                <p className="text-[10px] md:text-xs mt-0.5 font-medium" style={{ color: mateBlunder.color }}>
                  {mateBlunder.emoji} {mateBlunder.label}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <div className="w-12 md:w-20 h-1.5 md:h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: teammateAccuracy >= 90 ? '#22c55e' : teammateAccuracy >= 70 ? '#eab308' : '#ef4444' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${teammateAccuracy}%` }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                />
              </div>
              <span className={`font-bold text-sm md:text-xl ${!humanWon ? 'text-green-400' : 'text-gray-400'}`}>
                {teammateAccuracy.toFixed(0)}%
              </span>
            </div>
          </motion.div>
        </div>

        {/* Insight Tip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-2 md:mt-3 text-center"
        >
          {isSync && (
            <p className="text-yellow-400 text-xs md:text-sm font-medium">\u2728 Both played exactly the same move!</p>
          )}
          {!isSync && bothMatched && (
            <p className="text-yellow-400 text-xs md:text-sm font-medium">\uD83C\uDF1F Perfect — both matched the engine&apos;s best move!</p>
          )}
          {!isSync && youMatchedEngine && !teammateMatchedEngine && (
            <p className="text-green-400 text-xs md:text-sm font-medium">\uD83C\uDFAF You found the engine&apos;s top move!</p>
          )}
          {!isSync && !youMatchedEngine && teammateMatchedEngine && (
            <p className="text-blue-400 text-xs md:text-sm font-medium">\uD83D\uDCA1 Teammate found the engine&apos;s best move</p>
          )}
        </motion.div>

        {/* Alternative Engine Moves */}
        {alternatives.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-600"
          >
            <p className="text-[10px] md:text-xs text-gray-500 mb-1.5 md:mb-2">Other good moves:</p>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {alternatives.map((alt, i) => (
                <span
                  key={i}
                  className="text-[10px] md:text-xs bg-gray-700/60 text-gray-300 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full font-mono"
                >
                  {alt.move.replace(/(\w{2})(\w{2})/, '$1\u2192$2')}
                  <span className={alt.score >= 0 ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
                    {alt.score >= 0 ? '+' : ''}{alt.score}cp
                  </span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Centipawn Loss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-2 md:mt-4 pt-2 md:pt-3 border-t border-gray-600"
        >
          <div className="flex justify-between text-xs md:text-sm">
            <span className="text-gray-500">Centipawn Loss</span>
            <span className="text-gray-400">
              You: <span className={yourLoss <= teammateLoss ? 'text-green-400' : 'text-gray-300'}>{yourLoss}cp</span>
              {' \u00B7 '}
              Teammate: <span className={teammateLoss <= yourLoss ? 'text-green-400' : 'text-gray-300'}>{teammateLoss}cp</span>
            </span>
          </div>
        </motion.div>

        <InsightsGate
          playerId={playerId || ''}
          player1Move={comparison.player1Move}
          player2Move={comparison.player2Move}
          player1Accuracy={comparison.player1Accuracy}
          player2Accuracy={comparison.player2Accuracy}
          player1Loss={comparison.player1Loss}
          player2Loss={comparison.player2Loss}
          isSync={isSync}
          winnerId={comparison.winnerId as 'player1' | 'player2'}
          bestEngineMove={(comparison as any).bestEngineMove}
          bestEngineScore={(comparison as any).bestEngineScore}
        />
      </div>
    </motion.div>
  )
}
