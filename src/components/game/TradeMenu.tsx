import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, X } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { getTradeRatio } from '../../utils/gameLogic'
import type { ResourceType } from '../../types/game'
import { RESOURCE_CONFIG } from '../../utils/hexGrid'

const RESOURCE_TYPES: ResourceType[] = ['food', 'weapons', 'ammo', 'tools', 'supplies']

export function TradeMenu() {
  const game = useGameStore(s => s.game)
  const showTradeMenu = useGameStore(s => s.showTradeMenu)
  const toggleTradeMenu = useGameStore(s => s.toggleTradeMenu)
  const bankTrade = useGameStore(s => s.bankTrade)

  const [giving, setGiving] = useState<ResourceType>('food')
  const [receiving, setReceiving] = useState<ResourceType>('weapons')

  if (!game) return null
  const playerId = game.playerOrder[game.currentPlayerIndex]
  const player = game.players[playerId]
  const ratio = getTradeRatio(player, giving)
  const canTrade = player.resources[giving] >= ratio && giving !== receiving

  return (
    <div className="relative w-full">
      <button
        onClick={() => toggleTradeMenu()}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg font-semibold text-sm transition-all"
        style={{
          background: showTradeMenu ? '#065f46' : '#1a3a2e',
          border: `1px solid ${showTradeMenu ? '#10b981' : '#374151'}`,
          color: '#e2e8f0',
        }}
      >
        <ArrowLeftRight size={16} />
        Trade
      </button>

      <AnimatePresence>
        {showTradeMenu && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 w-72 rounded-xl p-4 z-50"
            style={{ background: '#0d1117', border: '1px solid #30363d', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-white/80">Bank Trade</span>
              <button onClick={() => toggleTradeMenu(false)} className="text-white/40 hover:text-white/80">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">You Give ({ratio}x)</label>
                <div className="grid grid-cols-5 gap-1">
                  {RESOURCE_TYPES.map(r => {
                    const cfg = RESOURCE_CONFIG[r]
                    const myRatio = getTradeRatio(player, r)
                    const affordable = player.resources[r] >= myRatio
                    return (
                      <button
                        key={r}
                        onClick={() => setGiving(r)}
                        className="flex flex-col items-center p-1.5 rounded-lg transition-all"
                        style={{
                          background: giving === r ? cfg.bgColor : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${giving === r ? cfg.color + '80' : 'rgba(255,255,255,0.08)'}`,
                          opacity: affordable ? 1 : 0.4,
                        }}
                      >
                        <span className="text-lg">{cfg.icon}</span>
                        <span className="text-xs font-bold" style={{ color: cfg.color }}>
                          {player.resources[r]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-center">
                <ArrowLeftRight size={16} className="text-white/30" />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">You Receive (1x)</label>
                <div className="grid grid-cols-5 gap-1">
                  {RESOURCE_TYPES.map(r => {
                    const cfg = RESOURCE_CONFIG[r]
                    return (
                      <button
                        key={r}
                        onClick={() => setReceiving(r)}
                        disabled={r === giving}
                        className="flex flex-col items-center p-1.5 rounded-lg transition-all"
                        style={{
                          background: receiving === r ? cfg.bgColor : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${receiving === r ? cfg.color + '80' : 'rgba(255,255,255,0.08)'}`,
                          opacity: r === giving ? 0.3 : 1,
                          cursor: r === giving ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span className="text-lg">{cfg.icon}</span>
                        <span className="text-xs" style={{ color: cfg.color }}>
                          {RESOURCE_CONFIG[r].label.slice(0, 3)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={() => { if (canTrade) { bankTrade(giving, receiving); toggleTradeMenu(false) } }}
                disabled={!canTrade}
                className="w-full py-2 rounded-lg font-bold text-sm transition-all"
                style={{
                  background: canTrade ? '#065f46' : 'rgba(255,255,255,0.05)',
                  color: canTrade ? '#6ee7b7' : '#ffffff40',
                  border: `1px solid ${canTrade ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                  cursor: canTrade ? 'pointer' : 'not-allowed',
                }}
              >
                {canTrade
                  ? `Trade ${ratio} ${RESOURCE_CONFIG[giving].label} → 1 ${RESOURCE_CONFIG[receiving].label}`
                  : `Need ${ratio} ${RESOURCE_CONFIG[giving].label}`}
              </button>

              {player.ports.length > 0 && (
                <div className="text-xs text-white/40 text-center">
                  Your ports: {player.ports.map(p => p === 'generic' ? '3:1' : `${p} 2:1`).join(', ')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
