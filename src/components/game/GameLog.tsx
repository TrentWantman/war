import { useRef, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { PLAYER_HEX_COLORS } from '../../constants/colors'

export function GameLog() {
  const game = useGameStore(s => s.game)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [game?.log.length])

  if (!game) return null

  const playerColors: Record<string, string> = {}
  for (const [id, player] of Object.entries(game.players)) {
    playerColors[id] = PLAYER_HEX_COLORS[player.color]
  }

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden"
      style={{ background: '#0d1117', border: '1px solid #21262d' }}
    >
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #21262d' }}>
        <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Game Log</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {game.log.slice(-50).map((entry) => (
          <div key={entry.id} className="text-xs leading-relaxed">
            <span className="text-white/20 mr-1.5 font-mono">T{entry.turn}</span>
            {entry.playerId && (
              <span
                className="font-semibold mr-1"
                style={{ color: playerColors[entry.playerId] ?? '#888' }}
              >
                {game.players[entry.playerId]?.name.split(' ')[0]}:
              </span>
            )}
            <span className="text-white/70">{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
