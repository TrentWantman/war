import { motion, AnimatePresence } from 'framer-motion'
import { Hammer, Truck, Home, Building2, CreditCard, X } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/react/shallow'
import { COSTS, canAfford } from '../../utils/gameLogic'

interface CostBadgeProps {
  costs: Record<string, number>
}

function CostBadge({ costs }: CostBadgeProps) {
  const icons: Record<string, string> = {
    food: '🌾', weapons: '⚔️', ammo: '💣', tools: '🔧', supplies: '📦',
  }
  const colors: Record<string, string> = {
    food: '#f59e0b', weapons: '#ef4444', ammo: '#9ca3af', tools: '#b45309', supplies: '#86efac',
  }
  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {Object.entries(costs)
        .filter(([, v]) => v > 0)
        .map(([res, count]) => (
          <span
            key={res}
            className="text-xs px-1 py-0.5 rounded font-medium"
            style={{ color: colors[res], background: colors[res] + '20', border: `1px solid ${colors[res]}40` }}
          >
            {icons[res]}{count}
          </span>
        ))}
    </div>
  )
}

export function BuildMenu() {
  const game = useGameStore(s => s.game)
  const showBuildMenu = useGameStore(s => s.showBuildMenu)
  const toggleBuildMenu = useGameStore(s => s.toggleBuildMenu)
  const buyDevCard = useGameStore(s => s.buyDevCard)
  const validOutposts = useGameStore(useShallow(s => s.getValidOutpostVertices()))
  const validBases = useGameStore(useShallow(s => s.getValidBaseVertices()))
  const validRoutes = useGameStore(useShallow(s => s.getValidRouteEdges()))

  if (!game) return null
  const playerId = game.playerOrder[game.currentPlayerIndex]
  const player = game.players[playerId]

  const canBuildRoute = canAfford(player, COSTS.route) && validRoutes.length > 0
  const canBuildOutpost = canAfford(player, COSTS.outpost) && validOutposts.length > 0
  const canBuildBase = canAfford(player, COSTS.base) && validBases.length > 0
  const canBuyDev = canAfford(player, COSTS.devCard) && game.devCardDeck.length > 0

  const items = [
    {
      icon: <Truck size={18} />,
      label: 'Supply Route',
      subLabel: 'Road',
      costs: COSTS.route,
      can: canBuildRoute,
      hint: 'Click a valid edge on the board',
      onClick: () => { /* handled by edge click */ },
    },
    {
      icon: <Home size={18} />,
      label: 'Outpost',
      subLabel: 'Settlement',
      costs: COSTS.outpost,
      can: canBuildOutpost,
      hint: 'Click a valid vertex on the board',
      onClick: () => { /* handled by vertex click */ },
    },
    {
      icon: <Building2 size={18} />,
      label: 'Base',
      subLabel: 'City',
      costs: COSTS.base,
      can: canBuildBase,
      hint: 'Click your outpost to upgrade',
      onClick: () => { /* handled by vertex click */ },
    },
    {
      icon: <CreditCard size={18} />,
      label: 'Dev Card',
      subLabel: `${game.devCardDeck.length} remaining`,
      costs: COSTS.devCard,
      can: canBuyDev,
      hint: '',
      onClick: () => { buyDevCard(); toggleBuildMenu(false) },
    },
  ]

  return (
    <div className="relative w-full">
      <button
        onClick={() => toggleBuildMenu()}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg font-semibold text-sm transition-all"
        style={{
          background: showBuildMenu ? '#1e40af' : '#1e3a5f',
          border: `1px solid ${showBuildMenu ? '#3b82f6' : '#374151'}`,
          color: '#e2e8f0',
        }}
      >
        <Hammer size={16} />
        Build
      </button>

      <AnimatePresence>
        {showBuildMenu && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 w-64 rounded-xl p-3 z-50"
            style={{ background: '#0d1117', border: '1px solid #30363d', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white/80">Build Menu</span>
              <button onClick={() => toggleBuildMenu(false)} className="text-white/40 hover:text-white/80">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5">
              {items.map(item => (
                <motion.button
                  key={item.label}
                  whileHover={item.can ? { x: 2 } : {}}
                  onClick={item.onClick}
                  disabled={!item.can}
                  className="w-full text-left p-2.5 rounded-lg transition-all"
                  style={{
                    background: item.can ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${item.can ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
                    opacity: item.can ? 1 : 0.5,
                    cursor: item.can ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className={item.can ? 'text-blue-400' : 'text-white/30'}>{item.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-white/90">{item.label}</div>
                      <div className="text-xs text-white/40">{item.subLabel}</div>
                    </div>
                  </div>
                  <CostBadge costs={item.costs} />
                  {item.can && item.hint && (
                    <div className="text-xs text-white/40 mt-1 italic">{item.hint}</div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
