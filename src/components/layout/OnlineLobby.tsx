import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Wifi, WifiOff, Loader2, ArrowLeft } from 'lucide-react'
import { PLAYER_HEX_COLORS } from '../../constants/colors'
import type { PlayerColor } from '../../types/game'

interface RoomPlayer {
  id: string
  name: string
  color: string
  isAI: boolean
  isConnected: boolean
  isReady: boolean
}

interface Room {
  id: string
  code: string
  hostId: string
  players: Record<string, RoomPlayer>
  maxPlayers: number
  state: string
}

interface OnlineLobbyProps {
  status: 'disconnected' | 'connecting' | 'connected'
  room: Room | null
  playerId: string | null
  error: string | null
  onCreateRoom: (name: string) => void
  onJoinRoom: (code: string, name: string) => void
  onToggleReady: () => void
  onStartGame: () => void
  onLeaveRoom: () => void
  onBack: () => void
}

export function OnlineLobby({
  status, room, playerId, error,
  onCreateRoom, onJoinRoom, onToggleReady, onStartGame, onLeaveRoom, onBack,
}: OnlineLobbyProps) {
  const [name, setName] = useState('Commander')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    if (!room) return
    navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isHost = room && playerId === room.hostId
  const players = room ? Object.values(room.players) : []
  const allReady = players.length >= 2 && players.every(p => p.isReady || p.id === room?.hostId)

  if (room) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a2744 0%, #0d1117 60%)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg rounded-2xl p-6"
          style={{ background: '#161b22', border: '1px solid #30363d' }}
        >
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              <ArrowLeft size={14} />
              Leave
            </button>
            <div className="flex items-center gap-2">
              <Wifi size={14} className="text-green-400" />
              <span className="text-xs text-green-400">Connected</span>
            </div>
          </div>

          <div className="text-center mb-6">
            <p className="text-xs text-white/40 mb-1">Room Code</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-black tracking-widest text-white">{room.code}</span>
              <button
                onClick={copyCode}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-white/40" />}
              </button>
            </div>
            <p className="text-xs text-white/30 mt-1">Share this code with your friends</p>
          </div>

          <div className="space-y-2 mb-6">
            <p className="text-xs font-bold text-white/30 uppercase tracking-wider">
              Players ({players.length}/{room.maxPlayers})
            </p>
            {players.map(player => {
              const color = PLAYER_HEX_COLORS[player.color as PlayerColor] ?? '#888'
              const isMe = player.id === playerId
              const isPlayerHost = player.id === room.hostId
              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    background: isMe ? `${color}15` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isMe ? color + '40' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <span className="font-medium text-sm text-white/90">{player.name}</span>
                    {isPlayerHost && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">HOST</span>
                    )}
                    {isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">YOU</span>
                    )}
                  </div>
                  <div>
                    {player.isReady || isPlayerHost ? (
                      <span className="text-xs font-bold text-green-400">Ready</span>
                    ) : (
                      <span className="text-xs text-white/30">Waiting...</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!allReady}
              className="w-full py-3 rounded-xl font-black text-sm transition-all"
              style={{
                background: allReady ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'rgba(255,255,255,0.05)',
                color: allReady ? '#fff' : '#ffffff40',
                cursor: allReady ? 'pointer' : 'not-allowed',
                boxShadow: allReady ? '0 8px 32px rgba(220,38,38,0.4)' : 'none',
              }}
            >
              {allReady ? 'Start Game' : 'Waiting for players to ready up...'}
            </button>
          ) : (
            <button
              onClick={onToggleReady}
              className="w-full py-3 rounded-xl font-black text-sm transition-all"
              style={{
                background: players.find(p => p.id === playerId)?.isReady
                  ? '#065f46'
                  : 'linear-gradient(135deg, #1e40af, #1d4ed8)',
                color: '#fff',
                border: '1px solid ' + (players.find(p => p.id === playerId)?.isReady ? '#10b981' : '#3b82f6'),
              }}
            >
              {players.find(p => p.id === playerId)?.isReady ? 'Ready! Waiting for host...' : 'Ready Up'}
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a2744 0%, #0d1117 60%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1
          className="text-5xl font-black tracking-tighter mb-2"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          WAR Online
        </h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          {status === 'connected' && <Wifi size={14} className="text-green-400" />}
          {status === 'connecting' && <Loader2 size={14} className="text-yellow-400 animate-spin" />}
          {status === 'disconnected' && <WifiOff size={14} className="text-red-400" />}
          <span className="text-xs text-white/40">
            {status === 'connected' && 'Connected to server'}
            {status === 'connecting' && 'Connecting...'}
            {status === 'disconnected' && 'Disconnected'}
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#161b22', border: '1px solid #30363d' }}
      >
        <div className="mb-4">
          <label className="text-xs text-white/50 mb-1.5 block">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            className="w-full px-3 py-2 rounded-lg bg-white/5 text-white border border-white/10 focus:border-white/30 outline-none text-sm"
            placeholder="Enter your name..."
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-lg text-xs text-red-300"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444440' }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => name.trim() && onCreateRoom(name.trim())}
          disabled={status !== 'connected' || !name.trim()}
          className="w-full py-3 rounded-xl font-black text-sm transition-all mb-3"
          style={{
            background: status === 'connected' && name.trim()
              ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
              : 'rgba(255,255,255,0.05)',
            color: status === 'connected' && name.trim() ? '#fff' : '#ffffff40',
            cursor: status === 'connected' && name.trim() ? 'pointer' : 'not-allowed',
            boxShadow: status === 'connected' && name.trim() ? '0 8px 32px rgba(220,38,38,0.4)' : 'none',
          }}
        >
          Create Room
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30">or join a friend</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white border border-white/10 focus:border-white/30 outline-none text-sm tracking-widest text-center font-bold uppercase"
            placeholder="CODE"
          />
          <button
            onClick={() => name.trim() && joinCode.length === 4 && onJoinRoom(joinCode, name.trim())}
            disabled={status !== 'connected' || !name.trim() || joinCode.length !== 4}
            className="px-6 py-2 rounded-xl font-bold text-sm transition-all"
            style={{
              background: status === 'connected' && joinCode.length === 4
                ? '#1e40af'
                : 'rgba(255,255,255,0.05)',
              color: status === 'connected' && joinCode.length === 4 ? '#fff' : '#ffffff40',
              border: `1px solid ${status === 'connected' && joinCode.length === 4 ? '#3b82f6' : 'rgba(255,255,255,0.06)'}`,
              cursor: status === 'connected' && joinCode.length === 4 ? 'pointer' : 'not-allowed',
            }}
          >
            Join
          </button>
        </div>

        <button
          onClick={onBack}
          className="w-full mt-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Back to Local Play
        </button>
      </motion.div>
    </div>
  )
}
