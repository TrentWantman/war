import { useState, useCallback } from 'react'
import { useGameStore } from './store/gameStore'
import { useMultiplayer } from './hooks/useMultiplayer'
import { Lobby } from './components/layout/Lobby'
import { OnlineLobby } from './components/layout/OnlineLobby'
import { GameLayout } from './components/layout/GameLayout'

type AppMode = 'menu' | 'local' | 'online'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'

interface RoomState {
  room: { id: string; code: string; hostId: string; players: Record<string, unknown>; maxPlayers: number; state: string } | null
  playerId: string | null
  error: string | null
}

function App() {
  const game = useGameStore(s => s.game)
  const [mode, setMode] = useState<AppMode>('menu')
  const [roomState, setRoomState] = useState<RoomState>({ room: null, playerId: null, error: null })

  const onMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'room_created':
      case 'room_joined':
        setRoomState({
          room: msg.room as RoomState['room'],
          playerId: msg.playerId as string,
          error: null,
        })
        break
      case 'room_updated':
        setRoomState(prev => ({ ...prev, room: msg.room as RoomState['room'], error: null }))
        break
      case 'player_joined':
      case 'player_left':
        break
      case 'game_started':
        useGameStore.getState().startGame()
        break
      case 'error':
        setRoomState(prev => ({ ...prev, error: msg.message as string }))
        break
    }
  }, [])

  const { status, send } = useMultiplayer({
    url: WS_URL,
    onMessage,
    enabled: mode === 'online',
  })

  if (game) {
    return <GameLayout />
  }

  if (mode === 'menu') {
    return <MainMenu onLocal={() => setMode('local')} onOnline={() => setMode('online')} />
  }

  if (mode === 'local') {
    return <Lobby />
  }

  return (
    <OnlineLobby
      status={status}
      room={roomState.room as Parameters<typeof OnlineLobby>[0]['room']}
      playerId={roomState.playerId}
      error={roomState.error}
      onCreateRoom={(name) => send({ type: 'create_room', playerName: name })}
      onJoinRoom={(code, name) => send({ type: 'join_room', roomCode: code, playerName: name })}
      onToggleReady={() => send({ type: 'toggle_ready' })}
      onStartGame={() => send({ type: 'start_game' })}
      onLeaveRoom={() => {
        send({ type: 'leave_room' })
        setRoomState({ room: null, playerId: null, error: null })
      }}
      onBack={() => {
        setRoomState({ room: null, playerId: null, error: null })
        setMode('menu')
      }}
    />
  )
}

function MainMenu({ onLocal, onOnline }: { onLocal: () => void; onOnline: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a2744 0%, #0d1117 60%)' }}
    >
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
      <p className="text-white/40 text-sm mb-12">a game of strategy and conquest</p>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={onLocal}
          className="w-full py-4 rounded-xl font-black text-lg transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(220,38,38,0.4)',
          }}
        >
          Local Game
        </button>
        <button
          onClick={onOnline}
          className="w-full py-4 rounded-xl font-black text-lg transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #1e40af, #1d4ed8)',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(30,64,175,0.4)',
          }}
        >
          Play Online
        </button>
      </div>
    </div>
  )
}

export default App
