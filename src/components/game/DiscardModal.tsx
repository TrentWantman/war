import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { discardAmount, totalResources } from '../../utils/gameLogic'
import { RESOURCE_LABELS, RESOURCE_COLORS, RESOURCE_BG_COLORS, RESOURCE_TYPES } from '../../constants/resources'

export function DiscardModal() {
  const game = useGameStore(s => s.game)
  const showDiscardMenu = useGameStore(s => s.showDiscardMenu)
  const discardTarget = useGameStore(s => s.discardTarget)
  const discardSelections = useGameStore(s => s.discardSelections)
  const updateDiscardSelection = useGameStore(s => s.updateDiscardSelection)
  const confirmDiscard = useGameStore(s => s.confirmDiscard)

  if (!game || !showDiscardMenu || !discardTarget) return null

  const player = game.players[discardTarget]
  if (player.isAI) return null
  const needed = discardAmount(player)
  const selected = totalResources(discardSelections)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-96 rounded-2xl p-6"
        style={{ background: '#161b22', border: '1px solid #ef444460' }}
      >
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white mb-1">Discard Required</h2>
          <p className="text-sm text-white/60">
            <span className="font-bold text-white">{player.name}</span> has too many resources.
            Discard {needed} cards.
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-sm text-white/50">Selected:</span>
            <span className={`font-bold ${selected === needed ? 'text-green-400' : 'text-white'}`}>
              {selected} / {needed}
            </span>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {RESOURCE_TYPES.map(r => {
            const available = player.resources[r]
            const sel = discardSelections[r]
            if (available === 0) return null
            return (
              <div
                key={r}
                className="flex items-center justify-between p-2 rounded-lg"
                style={{ background: RESOURCE_BG_COLORS[r], border: `1px solid ${RESOURCE_COLORS[r]}30` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: RESOURCE_COLORS[r] }}>
                    {RESOURCE_LABELS[r]}
                  </span>
                  <span className="text-xs text-white/40">({available} owned)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateDiscardSelection(r, -1)}
                    disabled={sel <= 0}
                    className="w-7 h-7 rounded-full font-bold text-white/80 disabled:opacity-30 transition-all"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-bold text-white">{sel}</span>
                  <button
                    onClick={() => updateDiscardSelection(r, 1)}
                    disabled={sel >= available || selected >= needed}
                    className="w-7 h-7 rounded-full font-bold text-white/80 disabled:opacity-30 transition-all"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={confirmDiscard}
          disabled={selected !== needed}
          className="w-full py-3 rounded-xl font-black text-sm transition-all"
          style={{
            background: selected === needed ? '#dc2626' : 'rgba(255,255,255,0.05)',
            color: selected === needed ? '#fff' : '#ffffff40',
            border: `1px solid ${selected === needed ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
            cursor: selected === needed ? 'pointer' : 'not-allowed',
          }}
        >
          {selected === needed ? `Discard ${needed} Resources` : `Select ${needed - selected} more`}
        </button>
      </motion.div>
    </motion.div>
  )
}
