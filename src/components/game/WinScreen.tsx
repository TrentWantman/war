import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { calculateVP } from '../../utils/gameLogic'
import { PLAYER_HEX_COLORS } from '../../constants/colors'

export function WinScreen() {
  const game = useGameStore(s => s.game)
  const startGame = useGameStore(s => s.startGame)

  if (!game || !game.winner) return null

  const winner = game.players[game.winner]
  const color = PLAYER_HEX_COLORS[winner.color]

  const standings = game.playerOrder
    .map(id => ({ player: game.players[id], vp: calculateVP(game, id) }))
    .sort((a, b) => b.vp - a.vp)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.4 }}
        className="text-center max-w-md w-full mx-4 rounded-2xl p-8"
        style={{
          background: '#0d1117',
          border: `2px solid ${color}`,
          boxShadow: `0 0 60px ${color}40`,
        }}
      >
        <h1
          className="text-4xl font-black mb-2"
          style={{ color }}
        >
          VICTORY
        </h1>
        <p className="text-xl font-bold text-white mb-1">{winner.name}</p>
        <p className="text-white/50 mb-6">Achieved {calculateVP(game, game.winner)} victory points</p>

        <div className="space-y-2 mb-8">
          {standings.map(({ player, vp }, i) => (
            <div
              key={player.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                background: i === 0 ? `${color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${i === 0 ? color + '40' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-white/40 w-4">{i + 1}.</span>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: PLAYER_HEX_COLORS[player.color] }}
                />
                <span className="font-medium text-white/90">{player.name}</span>
              </div>
              <span className="font-bold text-yellow-400">VP {vp}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={startGame}
            className="flex-1 py-3 rounded-xl font-black text-sm transition-all hover:scale-105"
            style={{
              background: color,
              color: '#000',
            }}
          >
            Play Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-3 rounded-xl font-black text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Main Menu
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
