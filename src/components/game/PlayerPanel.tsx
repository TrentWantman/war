import { motion } from 'framer-motion'
import type { Player, GameState } from '../../types/game'
import { PLAYER_HEX_COLORS } from '../../constants/colors'
import { calculateVP, totalResources } from '../../utils/gameLogic'
import { countPlayerBuildings } from '../../store/helpers'

interface PlayerPanelProps {
  player: Player
  isCurrentPlayer: boolean
  isLocalPlayer: boolean
  state: GameState
}

export function PlayerPanel({ player, isCurrentPlayer, isLocalPlayer, state }: PlayerPanelProps) {
  const vp = calculateVP(state, player.id)
  const color = PLAYER_HEX_COLORS[player.color]
  const counts = countPlayerBuildings(state, player.id)
  const total = totalResources(player.resources)

  return (
    <motion.div
      animate={{ scale: isCurrentPlayer ? 1.02 : 1 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg p-2.5 transition-all"
      style={{
        background: isCurrentPlayer
          ? `linear-gradient(135deg, ${color}20, ${color}08)`
          : 'rgba(22, 27, 34, 0.8)',
        border: `1px solid ${isCurrentPlayer ? color + '60' : '#30363d'}`,
        boxShadow: isCurrentPlayer ? `0 0 20px ${color}20` : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: color, boxShadow: isCurrentPlayer ? `0 0 6px ${color}` : 'none' }}
          />
          <span className={`font-bold text-xs ${isCurrentPlayer ? 'text-white' : 'text-white/70'}`}>
            {player.name}
          </span>
          {player.isAI && (
            <span className="text-xs px-1 rounded bg-white/10 text-white/30" style={{ fontSize: 9 }}>AI</span>
          )}
          {isLocalPlayer && (
            <span className="text-xs px-1 rounded bg-blue-500/20 text-blue-400" style={{ fontSize: 9 }}>YOU</span>
          )}
        </div>
        <span className="text-yellow-400 font-bold text-xs">VP {vp}</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-white/40" style={{ fontSize: 10 }}>
        <span>{total} cards</span>
        <span>{counts.outposts}o {counts.bases}b {counts.routes}r</span>
        {player.devCards.length > 0 && <span>{player.devCards.length} dev</span>}
      </div>

      {isCurrentPlayer && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mt-1 text-center rounded py-0.5 font-bold"
          style={{ background: color + '20', color, fontSize: 9 }}
        >
          TURN
        </motion.div>
      )}

      <div className="flex items-center gap-2 mt-1 text-xs text-white/40" style={{ fontSize: 9 }}>
        {state.longestRoadPlayerId === player.id && (
          <span className="text-blue-400">Longest Road</span>
        )}
        {state.largestArmyPlayerId === player.id && (
          <span className="text-red-400">Largest Force</span>
        )}
        {player.soldiersPlayed > 0 && (
          <span>Soldiers: {player.soldiersPlayed}</span>
        )}
      </div>
    </motion.div>
  )
}
