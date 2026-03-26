import { useState, useCallback, useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { useMultiplayer } from './hooks/useMultiplayer'
import { Lobby } from './components/layout/Lobby'
import { OnlineLobby } from './components/layout/OnlineLobby'
import { GameLayout } from './components/layout/GameLayout'
import type { GameState } from './types/game'

type AppMode = 'menu' | 'local' | 'online'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'

interface PublicRoomInfo {
  id: string
  code: string
  hostName: string
  playerCount: number
  maxPlayers: number
  mapId: string
}

interface RoomState {
  room: {
    id: string
    code: string
    hostId: string
    players: Record<string, unknown>
    maxPlayers: number
    state: string
    isPrivate: boolean
    mapId: string
  } | null
  playerId: string | null
  error: string | null
  publicRooms: PublicRoomInfo[]
}

function App() {
  const game = useGameStore(s => s.game)
  const [mode, setMode] = useState<AppMode>('menu')
  const [roomState, setRoomState] = useState<RoomState>({
    room: null,
    playerId: null,
    error: null,
    publicRooms: [],
  })

  const sendRef = useCallback((msg: Record<string, unknown>) => {
    sendWs(msg)
  }, [])

  const onMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'room_created':
      case 'room_joined':
        setRoomState(prev => ({
          ...prev,
          room: msg.room as RoomState['room'],
          playerId: msg.playerId as string,
          error: null,
        }))
        break
      case 'room_updated':
        setRoomState(prev => ({ ...prev, room: msg.room as RoomState['room'], error: null }))
        break
      case 'room_list':
        setRoomState(prev => ({ ...prev, publicRooms: msg.rooms as PublicRoomInfo[] }))
        break
      case 'game_started': {
        const store = useGameStore.getState()
        const pid = roomState.playerId
        if (pid) {
          store.setMultiplayer(pid, (gameState: GameState) => {
            sendRef({ type: 'state_sync', gameState })
          })
        }
        store.startGame()
        break
      }
      case 'state_sync': {
        const store = useGameStore.getState()
        if (!store.isMultiplayer) break
        const incomingState = msg.gameState as GameState
        if (incomingState) {
          store.receiveGameState(incomingState)
        }
        break
      }
      case 'error':
        setRoomState(prev => ({ ...prev, error: msg.message as string }))
        break
    }
  }, [roomState.playerId, sendRef])

  const { status, send: sendWs } = useMultiplayer({
    url: WS_URL,
    onMessage,
    enabled: mode === 'online',
  })

  useEffect(() => {
    if (mode !== 'online') {
      useGameStore.getState().clearMultiplayer()
    }
  }, [mode])

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
      publicRooms={roomState.publicRooms}
      onCreateRoom={(name, isPrivate) => sendWs({ type: 'create_room', playerName: name, isPrivate })}
      onJoinRoom={(code, name) => sendWs({ type: 'join_room', roomCode: code, playerName: name })}
      onJoinRoomById={(roomId, name) => sendWs({ type: 'join_room_by_id', roomId, playerName: name })}
      onToggleReady={() => sendWs({ type: 'toggle_ready' })}
      onStartGame={() => sendWs({ type: 'start_game' })}
      onLeaveRoom={() => {
        sendWs({ type: 'leave_room' })
        setRoomState({ room: null, playerId: null, error: null, publicRooms: roomState.publicRooms })
      }}
      onRefreshRooms={() => sendWs({ type: 'list_rooms' })}
      onBack={() => {
        setRoomState({ room: null, playerId: null, error: null, publicRooms: [] })
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
