import { motion } from 'framer-motion'
import type { Player, GameState } from '../../types/game'
import { ResourceDisplay } from '../ui/ResourceDisplay'
import { calculateVP } from '../../utils/gameLogic'

const PLAYER_COLORS: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', orange: '#f97316',
}

interface PlayerPanelProps {
  player: Player
  isCurrentPlayer: boolean
  state: GameState
}

export function PlayerPanel({ player, isCurrentPlayer, state }: PlayerPanelProps) {
  const vp = calculateVP(state, player.id)
  const color = PLAYER_COLORS[player.color]

  return (
    <motion.div
      animate={{ scale: isCurrentPlayer ? 1.02 : 1 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg p-3 transition-all"
      style={{
        background: isCurrentPlayer
          ? `linear-gradient(135deg, ${color}20, ${color}08)`
          : 'rgba(22, 27, 34, 0.8)',
        border: `1px solid ${isCurrentPlayer ? color + '60' : '#30363d'}`,
        boxShadow: isCurrentPlayer ? `0 0 20px ${color}20` : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: color, boxShadow: isCurrentPlayer ? `0 0 6px ${color}` : 'none' }}
          />
          <span className={`font-semibold text-sm ${isCurrentPlayer ? 'text-white' : 'text-white/70'}`}>
            {player.name}
          </span>
          {player.isAI && (
            <span className="text-xs px-1 py-0.5 rounded bg-white/10 text-white/40">AI</span>
          )}
          {isCurrentPlayer && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-xs px-1.5 py-0.5 rounded font-bold"
              style={{ background: color + '30', color }}
            >
              TURN
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-yellow-400 font-bold text-sm">⭐ {vp}</span>
          {vp >= 10 && <span className="text-yellow-300 text-xs font-bold animate-pulse">WIN!</span>}
        </div>
      </div>

      <ResourceDisplay resources={player.resources} compact />

      <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
        {player.devCards.length > 0 && (
          <span title="Development cards">🃏 {player.devCards.length}</span>
        )}
        {player.soldiersPlayed > 0 && (
          <span title="Soldiers played">⚔️ {player.soldiersPlayed}</span>
        )}
        {state.longestRoadPlayerId === player.id && (
          <span title="Longest Supply Line" className="text-blue-400">🛣️ Longest</span>
        )}
        {state.largestArmyPlayerId === player.id && (
          <span title="Largest Force" className="text-red-400">🏆 Largest Force</span>
        )}
      </div>
    </motion.div>
  )
}
