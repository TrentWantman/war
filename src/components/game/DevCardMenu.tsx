import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, X } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import type { DevCardType } from '../../types/game'
import { RESOURCE_LABELS, RESOURCE_COLORS, RESOURCE_BG_COLORS, RESOURCE_SHORT_LABELS, RESOURCE_TYPES } from '../../constants/resources'

const CARD_INFO: Record<DevCardType, { label: string; desc: string }> = {
  soldier: { label: 'Soldier', desc: 'Move robber, steal a resource. Counts toward Largest Force.' },
  road_building: { label: 'Road Building', desc: 'Place 2 free supply routes immediately.' },
  year_of_plenty: { label: 'Year of Plenty', desc: 'Take any 2 resources from the supply.' },
  monopoly: { label: 'Monopoly', desc: 'Name a resource. All players give you all of that resource.' },
  victory_point: { label: 'Victory Point', desc: 'Worth 1 victory point. Revealed when you win.' },
}

export function DevCardMenu() {
  const game = useGameStore(s => s.game)
  const showDevCardMenu = useGameStore(s => s.showDevCardMenu)
  const toggleDevCardMenu = useGameStore(s => s.toggleDevCardMenu)
  const playDevCard = useGameStore(s => s.playDevCard)
  const chooseMonopolyResource = useGameStore(s => s.chooseMonopolyResource)
  const chooseYearOfPlentyResource = useGameStore(s => s.chooseYearOfPlentyResource)
  const confirmYearOfPlenty = useGameStore(s => s.confirmYearOfPlenty)
  const yearOfPlentySelections = useGameStore(s => s.yearOfPlentySelections)

  const [monopolyStep, setMonopolyStep] = useState(false)
  const [yopStep, setYopStep] = useState(false)

  if (!game) return null
  const playerId = game.playerOrder[game.currentPlayerIndex]
  const player = game.players[playerId]
  const canPlayBase = !game.devCardPlayedThisTurn
  const canPlaySoldier = canPlayBase
  const canPlayOther = canPlayBase && game.hasRolled

  const cardCounts: Partial<Record<DevCardType, number>> = {}
  for (const card of player.devCards) {
    cardCounts[card] = (cardCounts[card] ?? 0) + 1
  }

  const playableCards = Object.entries(cardCounts).filter(
    ([type]) => type !== 'victory_point'
  ) as [DevCardType, number][]

  const vpCount = cardCounts['victory_point'] ?? 0

  return (
    <div className="relative w-full">
      <button
        onClick={() => toggleDevCardMenu()}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg font-semibold text-sm transition-all"
        style={{
          background: showDevCardMenu ? '#4c1d95' : '#2d1b69',
          border: `1px solid ${showDevCardMenu ? '#8b5cf6' : '#374151'}`,
          color: '#e2e8f0',
        }}
      >
        <Shield size={16} />
        Cards {player.devCards.length > 0 && `(${player.devCards.length})`}
      </button>

      <AnimatePresence>
        {showDevCardMenu && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 w-72 rounded-xl p-4 z-50"
            style={{ background: '#0d1117', border: '1px solid #30363d', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white/80">Development Cards</span>
              <button onClick={() => { toggleDevCardMenu(false); setMonopolyStep(false); setYopStep(false) }} className="text-white/40 hover:text-white/80">
                <X size={14} />
              </button>
            </div>

            {monopolyStep && (
              <div>
                <p className="text-xs text-white/60 mb-3">Choose a resource to monopolize:</p>
                <div className="grid grid-cols-5 gap-1">
                  {RESOURCE_TYPES.map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        chooseMonopolyResource(r)
                        setMonopolyStep(false)
                        toggleDevCardMenu(false)
                      }}
                      className="flex flex-col items-center p-2 rounded-lg"
                      style={{ background: RESOURCE_BG_COLORS[r], border: `1px solid ${RESOURCE_COLORS[r]}40` }}
                    >
                      <span className="text-xs font-bold" style={{ color: RESOURCE_COLORS[r] }}>
                        {RESOURCE_SHORT_LABELS[r]}
                      </span>
                      <span className="text-xs" style={{ color: RESOURCE_COLORS[r] }}>{RESOURCE_LABELS[r].slice(0, 4)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {yopStep && (
              <div>
                <p className="text-xs text-white/60 mb-1">
                  Choose {2 - yearOfPlentySelections.length} resource(s):
                </p>
                <div className="flex gap-1 mb-2">
                  {yearOfPlentySelections.map((r, i) => (
                    <span
                      key={i}
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ color: RESOURCE_COLORS[r], background: RESOURCE_BG_COLORS[r] }}
                    >
                      {RESOURCE_LABELS[r]}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1 mb-3">
                  {RESOURCE_TYPES.map(r => (
                    <button
                      key={r}
                      onClick={() => chooseYearOfPlentyResource(r)}
                      disabled={yearOfPlentySelections.length >= 2}
                      className="flex flex-col items-center p-2 rounded-lg"
                      style={{ background: RESOURCE_BG_COLORS[r], border: `1px solid ${RESOURCE_COLORS[r]}40` }}
                    >
                      <span className="text-xs font-bold" style={{ color: RESOURCE_COLORS[r] }}>
                        {RESOURCE_SHORT_LABELS[r]}
                      </span>
                    </button>
                  ))}
                </div>
                {yearOfPlentySelections.length === 2 && (
                  <button
                    onClick={() => { confirmYearOfPlenty(); setYopStep(false); toggleDevCardMenu(false) }}
                    className="w-full py-2 rounded-lg text-sm font-bold"
                    style={{ background: '#065f46', color: '#6ee7b7', border: '1px solid #10b981' }}
                  >
                    Confirm
                  </button>
                )}
              </div>
            )}

            {!monopolyStep && !yopStep && (
              <div className="space-y-1.5">
                {playableCards.length === 0 && vpCount === 0 && (
                  <p className="text-xs text-white/40 text-center py-2">No development cards</p>
                )}
                {playableCards.map(([type, count]) => {
                  const info = CARD_INFO[type]
                  const canPlayThis = type === 'soldier' ? canPlaySoldier : canPlayOther
                  return (
                    <motion.button
                      key={type}
                      whileHover={canPlayThis ? { x: 2 } : {}}
                      disabled={!canPlayThis}
                      onClick={() => {
                        if (type === 'monopoly') {
                          playDevCard(type)
                          setMonopolyStep(true)
                        } else if (type === 'year_of_plenty') {
                          playDevCard(type)
                          setYopStep(true)
                        } else {
                          playDevCard(type)
                          toggleDevCardMenu(false)
                        }
                      }}
                      className="w-full text-left p-2.5 rounded-lg transition-all"
                      style={{
                        background: canPlayThis ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${canPlayThis ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)'}`,
                        opacity: canPlayThis ? 1 : 0.5,
                        cursor: canPlayThis ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-sm font-medium text-white/90">
                            {info.label} <span className="text-white/40">x{count}</span>
                          </div>
                          <div className="text-xs text-white/40">{info.desc}</div>
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
                {vpCount > 0 && (
                  <div className="p-2.5 rounded-lg opacity-60"
                    style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}
                  >
                    <div className="text-sm font-medium text-white/90">Victory Point x{vpCount}</div>
                    <div className="text-xs text-white/40">Revealed automatically when you win</div>
                  </div>
                )}
                {game.devCardPlayedThisTurn && (
                  <p className="text-xs text-white/30 text-center">Already played a card this turn</p>
                )}
                {!game.hasRolled && !game.devCardPlayedThisTurn && (
                  <p className="text-xs text-white/30 text-center">Roll dice first (except Soldier)</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
