import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Bot, User, Play, Shield, Map } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { RESOURCE_LABELS, TERRAIN_LABELS, RESOURCE_COLORS } from '../../constants/resources'
import { MAP_CONFIGS } from '../../utils/maps'
import type { PlayerColor } from '../../types/game'

const COLORS = [
  { id: 'red' as PlayerColor, label: 'Red', hex: '#ef4444' },
  { id: 'blue' as PlayerColor, label: 'Blue', hex: '#3b82f6' },
  { id: 'green' as PlayerColor, label: 'Green', hex: '#22c55e' },
  { id: 'orange' as PlayerColor, label: 'Orange', hex: '#f97316' },
]

interface LobbyPlayer {
  name: string
  isAI: boolean
  color: PlayerColor
}

export function Lobby() {
  const setLobbyPlayers = useGameStore(s => s.setLobbyPlayers)
  const setMapId = useGameStore(s => s.setMapId)
  const selectedMapId = useGameStore(s => s.selectedMapId)
  const startGame = useGameStore(s => s.startGame)

  const [players, setPlayers] = useState<LobbyPlayer[]>([
    { name: 'Commander', isAI: false, color: 'red' },
    { name: 'General', isAI: true, color: 'blue' },
    { name: 'Colonel', isAI: true, color: 'green' },
  ])

  const addPlayer = () => {
    if (players.length >= 4) return
    const usedColors = new Set(players.map(p => p.color))
    const freeColor = COLORS.find(c => !usedColors.has(c.id))?.id ?? 'orange'
    setPlayers([...players, { name: `Soldier ${players.length + 1}`, isAI: true, color: freeColor }])
  }

  const removePlayer = (i: number) => {
    if (players.length <= 2) return
    setPlayers(players.filter((_, idx) => idx !== i))
  }

  const updatePlayer = (i: number, update: Partial<LobbyPlayer>) => {
    setPlayers(players.map((p, idx) => idx === i ? { ...p, ...update } : p))
  }

  const handleStart = () => {
    setLobbyPlayers(players)
    startGame()
  }

  const usedColors = new Set(players.map(p => p.color))

  const resourceEntries = (['food', 'weapons', 'ammo', 'tools', 'supplies'] as const).map(r => ({
    key: r,
    label: RESOURCE_LABELS[r],
    terrain: TERRAIN_LABELS[r],
    color: RESOURCE_COLORS[r],
  }))

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a2744 0%, #0d1117 60%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield size={48} className="text-red-500" />
        </div>
        <h1
          className="text-7xl font-black tracking-tighter mb-2"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          WAR
        </h1>
        <p className="text-white/40 text-sm mt-1">2-4 players</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: '#161b22', border: '1px solid #30363d' }}
      >
        <h2 className="text-lg font-bold text-white/80 mb-5 flex items-center gap-2">
          <User size={18} />
          Players
        </h2>

        <div className="space-y-3 mb-4">
          {players.map((player, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${COLORS.find(c => c.id === player.color)?.hex ?? '#fff'}30`,
              }}
            >
              <div className="flex gap-1">
                {COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (!usedColors.has(c.id) || player.color === c.id) {
                        updatePlayer(i, { color: c.id })
                      }
                    }}
                    className="w-5 h-5 rounded-full transition-all"
                    style={{
                      background: c.hex,
                      opacity: usedColors.has(c.id) && player.color !== c.id ? 0.2 : 1,
                      transform: player.color === c.id ? 'scale(1.25)' : 'scale(1)',
                      boxShadow: player.color === c.id ? `0 0 6px ${c.hex}` : 'none',
                      cursor: usedColors.has(c.id) && player.color !== c.id ? 'not-allowed' : 'pointer',
                    }}
                  />
                ))}
              </div>

              <input
                type="text"
                value={player.name}
                onChange={e => updatePlayer(i, { name: e.target.value })}
                maxLength={20}
                className="flex-1 bg-transparent text-sm font-medium text-white outline-none border-b border-white/10 focus:border-white/30 pb-0.5 transition-colors"
                placeholder="Player name..."
              />

              <button
                onClick={() => updatePlayer(i, { isAI: !player.isAI })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: player.isAI ? 'rgba(139,92,246,0.2)' : 'rgba(34,197,94,0.15)',
                  border: `1px solid ${player.isAI ? '#8b5cf640' : '#22c55e40'}`,
                  color: player.isAI ? '#a78bfa' : '#4ade80',
                }}
              >
                {player.isAI ? <Bot size={12} /> : <User size={12} />}
                {player.isAI ? 'AI' : 'Human'}
              </button>

              {players.length > 2 && (
                <button
                  onClick={() => removePlayer(i)}
                  className="text-white/20 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </motion.div>
          ))}
        </div>

        {players.length < 4 && (
          <button
            onClick={addPlayer}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <Plus size={14} />
            Add Player ({players.length}/4)
          </button>
        )}

        <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Map size={12} />
            Map
          </p>
          <div className="grid grid-cols-3 gap-2">
            {MAP_CONFIGS.map(map => (
              <button
                key={map.id}
                onClick={() => setMapId(map.id)}
                className="p-2 rounded-lg text-left transition-all"
                style={{
                  background: selectedMapId === map.id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedMapId === map.id ? '#ef444460' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div className={`text-xs font-bold ${selectedMapId === map.id ? 'text-red-400' : 'text-white/60'}`}>
                  {map.name}
                </div>
                <div className="text-xs text-white/25">{map.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3">Resources</p>
          <div className="grid grid-cols-5 gap-2">
            {resourceEntries.map(({ key, label, terrain, color }) => (
              <div key={key} className="text-center">
                <div className="text-sm font-bold mb-0.5" style={{ color }}>{label}</div>
                <div className="text-xs text-white/25">{terrain}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3">Build Costs</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { name: 'Supply Route', cost: '1 Tools + 1 Supplies' },
              { name: 'Outpost', cost: '1 Tools + 1 Supplies + 1 Food + 1 Weapons' },
              { name: 'Base', cost: '2 Food + 3 Ammo' },
              { name: 'Dev Card', cost: '1 Supplies + 1 Food + 1 Ammo' },
            ].map(({ name, cost }) => (
              <div key={name} className="flex flex-col">
                <span className="font-medium text-white/60">{name}</span>
                <span className="text-white/30">{cost}</span>
              </div>
            ))}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          className="w-full py-4 mt-6 rounded-xl font-black text-lg flex items-center justify-center gap-3 transition-all"
          style={{
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(220,38,38,0.4)',
          }}
        >
          <Play size={20} />
          Start Game
        </motion.button>
      </motion.div>
    </div>
  )
}
