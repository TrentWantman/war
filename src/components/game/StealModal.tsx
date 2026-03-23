import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { PLAYER_HEX_COLORS } from '../../constants/colors'

export function StealModal() {
  const game = useGameStore(s => s.game)
  const stealResource = useGameStore(s => s.stealResource)

  if (!game || game.phase !== 'stealing') return null

  const currentPlayerId = game.playerOrder[game.currentPlayerIndex]
  const robberTile = game.tiles[game.robberTileId]
  if (!robberTile) return null

  const stealTargets = new Set<string>()
  Object.values(game.vertices).forEach(v => {
    if (v.hexIds.includes(robberTile.id) && v.building && v.building.playerId !== currentPlayerId) {
      const res = game.players[v.building.playerId].resources
      const total = res.food + res.weapons + res.ammo + res.tools + res.supplies
      if (total > 0) stealTargets.add(v.building.playerId)
    }
  })

  const targets = [...stealTargets]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="w-80 rounded-2xl p-6"
        style={{ background: '#161b22', border: '1px solid #30363d' }}
      >
        <h2 className="text-lg font-black text-white mb-2">Choose a target to steal from</h2>
        <p className="text-sm text-white/50 mb-5">You will steal 1 random resource from your chosen target.</p>
        <div className="space-y-2">
          {targets.map(pid => {
            const player = game.players[pid]
            const color = PLAYER_HEX_COLORS[player.color]
            const total = Object.values(player.resources).reduce((a, b) => a + b, 0)
            return (
              <motion.button
                key={pid}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => stealResource(pid)}
                className="w-full flex items-center justify-between p-3 rounded-xl transition-all"
                style={{
                  background: `${color}15`,
                  border: `1px solid ${color}40`,
                  color: '#fff',
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span className="font-semibold">{player.name}</span>
                </div>
                <span className="text-sm text-white/50">{total} resources</span>
              </motion.button>
            )
          })}
          {targets.length === 0 && (
            <div className="text-center text-white/40 py-4">
              No targets with resources available
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
