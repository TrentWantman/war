import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { RESOURCE_COLORS, RESOURCE_SHORT_LABELS } from '../../constants/resources'
import { PLAYER_HEX_COLORS } from '../../constants/colors'
import type { ResourceType } from '../../types/game'

interface ProductionEntry {
  playerId: string
  playerName: string
  playerColor: string
  gains: [ResourceType, number][]
}

export function ProductionToast() {
  const game = useGameStore(s => s.game)
  const [production, setProduction] = useState<ProductionEntry[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!game || !game.lastRoll || game.lastRoll.total === 7) {
      setVisible(false)
      return
    }

    const logLength = game.log.length
    if (logLength === 0) return

    const lastLog = game.log[logLength - 1]
    if (!lastLog.message.includes('rolled')) return

    const entries: ProductionEntry[] = []
    for (const pid of game.playerOrder) {
      const player = game.players[pid]
      const gains = (Object.entries(player.resources) as [ResourceType, number][])
        .filter(([, v]) => v > 0)

      if (gains.length > 0) {
        entries.push({
          playerId: pid,
          playerName: player.name,
          playerColor: PLAYER_HEX_COLORS[player.color],
          gains,
        })
      }
    }

    if (entries.length > 0) {
      setProduction(entries)
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [game?.log.length])

  return (
    <AnimatePresence>
      {visible && production.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-2 right-2 z-20 space-y-1"
        >
          {production.map(entry => (
            <div
              key={entry.playerId}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
              style={{ background: 'rgba(0,0,0,0.8)', border: `1px solid ${entry.playerColor}40` }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: entry.playerColor }} />
              <span className="text-white/60">{entry.playerName}:</span>
              {entry.gains.map(([r, count]) => (
                <span key={r} className="font-bold" style={{ color: RESOURCE_COLORS[r] }}>
                  +{count} {RESOURCE_SHORT_LABELS[r]}
                </span>
              ))}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
