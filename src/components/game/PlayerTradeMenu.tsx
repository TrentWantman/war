import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { totalResources } from '../../utils/gameLogic'
import type { ResourceType, Resources } from '../../types/game'
import { EMPTY_RESOURCES } from '../../types/game'
import { RESOURCE_COLORS, RESOURCE_BG_COLORS, RESOURCE_SHORT_LABELS, RESOURCE_TYPES } from '../../constants/resources'
import { PLAYER_HEX_COLORS } from '../../constants/colors'

interface ResourceSelectorProps {
  label: string
  resources: Resources
  playerResources?: Resources
  onChange: (resource: ResourceType, delta: number) => void
}

function ResourceSelector({ label, resources, playerResources, onChange }: ResourceSelectorProps) {
  return (
    <div>
      <label className="text-xs text-white/50 mb-1.5 block">{label}</label>
      <div className="grid grid-cols-5 gap-1">
        {RESOURCE_TYPES.map(r => {
          const max = playerResources ? playerResources[r] : 99
          return (
            <div
              key={r}
              className="flex flex-col items-center p-1 rounded-lg"
              style={{
                background: resources[r] > 0 ? RESOURCE_BG_COLORS[r] : 'rgba(255,255,255,0.03)',
                border: `1px solid ${resources[r] > 0 ? RESOURCE_COLORS[r] + '60' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <span className="text-xs font-bold" style={{ color: RESOURCE_COLORS[r] }}>
                {RESOURCE_SHORT_LABELS[r]}
              </span>
              <div className="flex items-center gap-0.5 mt-0.5">
                <button
                  onClick={() => onChange(r, -1)}
                  disabled={resources[r] <= 0}
                  className="w-4 h-4 rounded text-xs font-bold text-white/60 disabled:opacity-20"
                >
                  -
                </button>
                <span className="text-xs font-bold text-white w-3 text-center">{resources[r]}</span>
                <button
                  onClick={() => onChange(r, 1)}
                  disabled={resources[r] >= max}
                  className="w-4 h-4 rounded text-xs font-bold text-white/60 disabled:opacity-20"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PlayerTradeMenu() {
  const game = useGameStore(s => s.game)
  const proposeTrade = useGameStore(s => s.proposeTrade)

  const [isOpen, setIsOpen] = useState(false)
  const [offering, setOffering] = useState<Resources>({ ...EMPTY_RESOURCES })
  const [requesting, setRequesting] = useState<Resources>({ ...EMPTY_RESOURCES })

  if (!game || game.phase !== 'playing' || !game.hasRolled) return null

  const playerId = game.playerOrder[game.currentPlayerIndex]
  const player = game.players[playerId]
  if (player.isAI) return null

  const hasOffer = totalResources(offering) > 0
  const hasRequest = totalResources(requesting) > 0
  const canPropose = hasOffer && hasRequest

  const handleOfferChange = (r: ResourceType, delta: number) => {
    setOffering(prev => ({
      ...prev,
      [r]: Math.max(0, Math.min(prev[r] + delta, player.resources[r])),
    }))
  }

  const handleRequestChange = (r: ResourceType, delta: number) => {
    setRequesting(prev => ({
      ...prev,
      [r]: Math.max(0, prev[r] + delta),
    }))
  }

  const handlePropose = () => {
    if (!canPropose) return
    proposeTrade(offering, requesting)
    setOffering({ ...EMPTY_RESOURCES })
    setRequesting({ ...EMPTY_RESOURCES })
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg font-semibold text-sm transition-all mt-1.5"
        style={{
          background: isOpen ? '#7c3aed' : '#4c1d95',
          border: `1px solid ${isOpen ? '#a78bfa' : '#6d28d9'}`,
          color: '#e2e8f0',
        }}
      >
        <Send size={14} />
        Player Trade
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 w-80 rounded-xl p-4 z-50"
            style={{ background: '#0d1117', border: '1px solid #30363d', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white/80">Propose Trade</span>
              <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white/80">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <ResourceSelector
                label="You offer"
                resources={offering}
                playerResources={player.resources}
                onChange={handleOfferChange}
              />

              <div className="flex items-center justify-center">
                <span className="text-xs text-white/30">for</span>
              </div>

              <ResourceSelector
                label="You want"
                resources={requesting}
                onChange={handleRequestChange}
              />

              <button
                onClick={handlePropose}
                disabled={!canPropose}
                className="w-full py-2 rounded-lg font-bold text-sm transition-all"
                style={{
                  background: canPropose ? '#7c3aed' : 'rgba(255,255,255,0.05)',
                  color: canPropose ? '#fff' : '#ffffff40',
                  border: `1px solid ${canPropose ? '#a78bfa' : 'rgba(255,255,255,0.08)'}`,
                  cursor: canPropose ? 'pointer' : 'not-allowed',
                }}
              >
                Propose to All Players
              </button>

              <p className="text-xs text-white/30 text-center">
                Other players will accept or decline
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function TradeResponseBanner() {
  const game = useGameStore(s => s.game)
  const respondTrade = useGameStore(s => s.respondTrade)
  const cancelTrade = useGameStore(s => s.cancelTrade)
  const isMultiplayer = useGameStore(s => s.isMultiplayer)
  const localPlayerId = useGameStore(s => s.localPlayerId)

  if (!game || !game.activeTrade) return null

  const trade = game.activeTrade
  const from = game.players[trade.fromPlayerId]
  const fromColor = PLAYER_HEX_COLORS[from.color]

  let myPlayerId: string
  if (isMultiplayer && localPlayerId) {
    myPlayerId = localPlayerId
  } else {
    myPlayerId = game.playerOrder.find(pid => !game.players[pid].isAI) ?? game.playerOrder[0]
  }

  const isProposer = trade.fromPlayerId === myPlayerId
  if (!isProposer && from.isAI) return null

  if (isProposer) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-3 mb-2 p-3 rounded-lg"
        style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid #7c3aed40' }}
      >
        <p className="text-xs text-white/60 mb-2">Your trade is open to all players...</p>
        <button
          onClick={cancelTrade}
          className="w-full py-1.5 rounded text-xs font-bold"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          Cancel Trade
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mb-2 p-3 rounded-lg"
      style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid #7c3aed40' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ background: fromColor }} />
        <span className="text-xs font-bold text-white/80">{from.name} offers a trade</span>
      </div>

      <div className="flex gap-2 mb-2 text-xs">
        <div className="flex-1">
          <span className="text-white/40">Offers:</span>
          <div className="flex gap-0.5 mt-0.5 flex-wrap">
            {RESOURCE_TYPES.filter(r => trade.offering[r] > 0).map(r => (
              <span key={r} className="px-1 py-0.5 rounded font-bold" style={{ color: RESOURCE_COLORS[r], background: RESOURCE_BG_COLORS[r] }}>
                {trade.offering[r]} {RESOURCE_SHORT_LABELS[r]}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <span className="text-white/40">Wants:</span>
          <div className="flex gap-0.5 mt-0.5 flex-wrap">
            {RESOURCE_TYPES.filter(r => trade.requesting[r] > 0).map(r => (
              <span key={r} className="px-1 py-0.5 rounded font-bold" style={{ color: RESOURCE_COLORS[r], background: RESOURCE_BG_COLORS[r] }}>
                {trade.requesting[r]} {RESOURCE_SHORT_LABELS[r]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            game.activeTrade!.toPlayerId = myPlayerId
            respondTrade(true)
          }}
          className="flex-1 py-1.5 rounded text-xs font-bold"
          style={{ background: '#065f46', color: '#6ee7b7', border: '1px solid #10b981' }}
        >
          Accept
        </button>
        <button
          onClick={() => respondTrade(false)}
          className="flex-1 py-1.5 rounded text-xs font-bold"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          Decline
        </button>
      </div>
    </motion.div>
  )
}
