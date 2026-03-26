import { motion, AnimatePresence } from 'framer-motion'
import { Dice5, ChevronRight, AlertTriangle, Target } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { useAIPlayer } from '../../hooks/useAIPlayer'
import { PLAYER_HEX_COLORS } from '../../constants/colors'
import { HexBoard } from '../board/HexBoard'
import { PlayerPanel } from '../game/PlayerPanel'
import { BuildMenu } from '../game/BuildMenu'
import { TradeMenu } from '../game/TradeMenu'
import { DevCardMenu } from '../game/DevCardMenu'
import { GameLog } from '../game/GameLog'
import { DiceDisplay } from '../ui/DiceDisplay'
import { DiscardModal } from '../game/DiscardModal'
import { StealModal } from '../game/StealModal'
import { WinScreen } from '../game/WinScreen'
import { PlayerTradeMenu, TradeResponseBanner } from '../game/PlayerTradeMenu'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { ResourceCards } from '../ui/ResourceCards'

const PHASE_LABELS: Record<string, string> = {
  setup: 'Initial Placement',
  playing: 'Main Game',
  robber: 'Move the Robber',
  discard: 'Discard Resources',
  stealing: 'Choose Target',
  road_building: 'Place 2 Free Roads',
  game_over: 'Game Over',
}

const SETUP_HINTS: Record<string, string> = {
  place_outpost: 'Click a valid vertex to place your outpost',
  place_route: 'Click an adjacent edge to place your supply route',
}

export function GameLayout() {
  useAIPlayer()
  useKeyboardShortcuts()
  const game = useGameStore(s => s.game)
  const rollDice = useGameStore(s => s.rollDice)
  const endTurn = useGameStore(s => s.endTurn)
  const isMyTurn = useGameStore(s => s.isMyTurn)
  const isMultiplayer = useGameStore(s => s.isMultiplayer)
  const localPlayerId = useGameStore(s => s.localPlayerId)

  if (!game) return null

  const currentPlayerId = game.playerOrder[game.currentPlayerIndex]
  const currentPlayer = game.players[currentPlayerId]
  const myTurn = isMyTurn()

  const canRoll = game.phase === 'playing' && !game.hasRolled && myTurn
  const canEndTurn = game.phase === 'playing' && game.hasRolled && myTurn
  const isSetup = game.phase === 'setup'

  const phaseLabel = PHASE_LABELS[game.phase] ?? game.phase
  const setupHint = isSetup ? SETUP_HINTS[game.setupSubPhase] : null
  const robberHint = game.phase === 'robber' ? 'Click a hex tile to place the robber' : null

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{ background: '#0d1117' }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: '#161b22', borderBottom: '1px solid #21262d' }}
      >
        <div className="flex items-center gap-4">
          <h1
            className="text-xl font-black tracking-tighter"
            style={{ color: '#ef4444' }}
          >
            WAR
          </h1>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2 py-1 rounded"
              style={{
                background: game.phase === 'robber' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
                color: game.phase === 'robber' ? '#fca5a5' : '#9ca3af',
                border: `1px solid ${game.phase === 'robber' ? '#ef444440' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {phaseLabel}
            </span>
            {(setupHint || robberHint) && (
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Target size={12} />
                {setupHint ?? robberHint}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30">Turn {game.turn}</span>
          <div
            className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e2e8f0',
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: PLAYER_HEX_COLORS[currentPlayer.color] }}
            />
            {currentPlayer.name}'s turn
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div
          className="w-48 flex-shrink-0 flex flex-col gap-2 p-3 overflow-y-auto"
          style={{ borderRight: '1px solid #21262d' }}
        >
          <div className="text-xs font-bold text-white/30 uppercase tracking-wider px-1">Players</div>
          {game.playerOrder.map(pid => {
            const isLocal = isMultiplayer ? pid === localPlayerId : !game.players[pid].isAI
            return (
              <PlayerPanel
                key={pid}
                player={game.players[pid]}
                isCurrentPlayer={pid === currentPlayerId}
                isLocalPlayer={isLocal}
                state={game}
              />
            )
          })}

          <div className="mt-2 space-y-1.5">
            {game.longestRoadPlayerId && (
              <div
                className="px-2 py-1.5 rounded text-xs flex items-center gap-1.5"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f620', color: '#93c5fd' }}
              >
                <span className="font-medium">Longest Road</span>
                <span className="ml-auto text-blue-400/60">({game.longestRoadLength})</span>
              </div>
            )}
            {game.largestArmyPlayerId && (
              <div
                className="px-2 py-1.5 rounded text-xs flex items-center gap-1.5"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444420', color: '#fca5a5' }}
              >
                <span className="font-medium">Largest Force</span>
                <span className="ml-auto text-red-400/60">({game.largestArmySize})</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center overflow-hidden relative">
            <AnimatePresence>
              {isSetup && myTurn && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2"
                  style={{ background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd' }}
                >
                  <Target size={14} />
                  {setupHint}
                </motion.div>
              )}
              {isSetup && !myTurn && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full font-bold text-sm"
                  style={{ background: '#1a1a2e', border: '1px solid #30363d', color: '#9ca3af' }}
                >
                  {currentPlayer.name} is placing...
                </motion.div>
              )}
              {game.phase === 'robber' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2"
                  style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca' }}
                >
                  <AlertTriangle size={14} />
                  {myTurn ? 'Click a hex to move the robber' : `${currentPlayer.name} is moving the robber...`}
                </motion.div>
              )}
            </AnimatePresence>
            <HexBoard />
          </div>

          <div
            className="flex-shrink-0 px-3 py-2 flex flex-col gap-2"
            style={{ background: '#161b22', borderTop: '1px solid #21262d' }}
          >
            <ResourceCards />
            <div className="flex items-center gap-3">
            <DiceDisplay roll={game.lastRoll} />

            {myTurn ? (
              <>
                <motion.button
                  whileHover={canRoll ? { scale: 1.02 } : {}}
                  whileTap={canRoll ? { scale: 0.98 } : {}}
                  onClick={rollDice}
                  disabled={!canRoll}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all"
                  style={{
                    background: canRoll
                      ? 'linear-gradient(135deg, #1e40af, #1d4ed8)'
                      : 'rgba(255,255,255,0.04)',
                    color: canRoll ? '#fff' : '#ffffff30',
                    border: `1px solid ${canRoll ? '#3b82f6' : 'rgba(255,255,255,0.06)'}`,
                    cursor: canRoll ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Dice5 size={16} />
                  Roll {canRoll && <span className="text-xs opacity-50">[R]</span>}
                </motion.button>

                {game.phase === 'playing' && (
                  <>
                    {game.hasRolled && (
                      <>
                        <div className="relative"><BuildMenu /></div>
                        <div className="relative"><TradeMenu /></div>
                      </>
                    )}
                    <div className="relative"><DevCardMenu /></div>
                    <div className="relative"><PlayerTradeMenu /></div>
                  </>
                )}

                <div className="flex-1" />

                <motion.button
                  whileHover={canEndTurn ? { scale: 1.02 } : {}}
                  whileTap={canEndTurn ? { scale: 0.98 } : {}}
                  onClick={endTurn}
                  disabled={!canEndTurn}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all"
                  style={{
                    background: canEndTurn
                      ? 'linear-gradient(135deg, #065f46, #047857)'
                      : 'rgba(255,255,255,0.04)',
                    color: canEndTurn ? '#fff' : '#ffffff30',
                    border: `1px solid ${canEndTurn ? '#10b981' : 'rgba(255,255,255,0.06)'}`,
                    cursor: canEndTurn ? 'pointer' : 'not-allowed',
                  }}
                >
                  End Turn {canEndTurn && <span className="text-xs opacity-50">[E]</span>}
                  <ChevronRight size={14} />
                </motion.button>
              </>
            ) : (
              <div className="flex-1 text-center">
                <span className="text-sm text-white/40">
                  Waiting for {currentPlayer.name}...
                </span>
              </div>
            )}
            </div>
          </div>
        </div>

        <div
          className="w-56 flex-shrink-0 flex flex-col"
          style={{ borderLeft: '1px solid #21262d' }}
        >
          <TradeResponseBanner />
          <div className="flex-1 min-h-0 p-3">
            <div className="h-full">
              <GameLog />
            </div>
          </div>
        </div>
      </div>

      <DiscardModal />
      <StealModal />
      <WinScreen />
    </div>
  )
}
