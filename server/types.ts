export interface RoomPlayer {
  id: string
  name: string
  color: string
  isAI: boolean
  isConnected: boolean
  isReady: boolean
}

export interface Room {
  id: string
  code: string
  hostId: string
  players: Record<string, RoomPlayer>
  maxPlayers: number
  state: 'waiting' | 'playing' | 'finished'
  createdAt: number
}

export type ClientMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join_room'; roomCode: string; playerName: string }
  | { type: 'leave_room' }
  | { type: 'toggle_ready' }
  | { type: 'start_game' }
  | { type: 'game_action'; action: string; payload: Record<string, unknown> }
  | { type: 'chat'; message: string }

export type ServerMessage =
  | { type: 'room_created'; room: Room; playerId: string }
  | { type: 'room_joined'; room: Room; playerId: string }
  | { type: 'room_updated'; room: Room }
  | { type: 'player_joined'; player: RoomPlayer }
  | { type: 'player_left'; playerId: string }
  | { type: 'game_started'; seed: number }
  | { type: 'game_action'; action: string; payload: Record<string, unknown>; fromPlayerId: string }
  | { type: 'chat'; message: string; fromPlayerId: string; playerName: string }
  | { type: 'error'; message: string }
  | { type: 'ping' }
