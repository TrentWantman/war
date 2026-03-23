import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import type { Room, RoomPlayer, ClientMessage, ServerMessage } from './types.js'

const PORT = parseInt(process.env.WS_PORT ?? '3001', 10)
const PLAYER_COLORS = ['red', 'blue', 'green', 'orange']

const wss = new WebSocketServer({ port: PORT })
const rooms = new Map<string, Room>()
const clientRooms = new Map<WebSocket, { roomId: string; playerId: string }>()

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function broadcast(roomId: string, message: ServerMessage, exclude?: WebSocket): void {
  const data = JSON.stringify(message)
  wss.clients.forEach(client => {
    if (client === exclude) return
    if (client.readyState !== WebSocket.OPEN) return
    const info = clientRooms.get(client)
    if (info?.roomId === roomId) {
      client.send(data)
    }
  })
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

function getNextColor(room: Room): string {
  const usedColors = new Set(Object.values(room.players).map(p => p.color))
  return PLAYER_COLORS.find(c => !usedColors.has(c)) ?? 'red'
}

function handleMessage(ws: WebSocket, message: ClientMessage): void {
  switch (message.type) {
    case 'create_room': {
      const playerId = uuidv4()
      const roomId = uuidv4()
      const code = generateRoomCode()
      const player: RoomPlayer = {
        id: playerId,
        name: message.playerName,
        color: 'red',
        isAI: false,
        isConnected: true,
        isReady: false,
      }
      const room: Room = {
        id: roomId,
        code,
        hostId: playerId,
        players: { [playerId]: player },
        maxPlayers: 4,
        state: 'waiting',
        createdAt: Date.now(),
      }
      rooms.set(roomId, room)
      clientRooms.set(ws, { roomId, playerId })
      send(ws, { type: 'room_created', room, playerId })
      break
    }

    case 'join_room': {
      const room = [...rooms.values()].find(
        r => r.code === message.roomCode.toUpperCase()
      )
      if (!room) {
        send(ws, { type: 'error', message: 'Room not found' })
        return
      }
      if (Object.keys(room.players).length >= room.maxPlayers) {
        send(ws, { type: 'error', message: 'Room is full' })
        return
      }
      if (room.state !== 'waiting') {
        send(ws, { type: 'error', message: 'Game already in progress' })
        return
      }

      const playerId = uuidv4()
      const player: RoomPlayer = {
        id: playerId,
        name: message.playerName,
        color: getNextColor(room),
        isAI: false,
        isConnected: true,
        isReady: false,
      }
      room.players[playerId] = player
      clientRooms.set(ws, { roomId: room.id, playerId })

      send(ws, { type: 'room_joined', room, playerId })
      broadcast(room.id, { type: 'player_joined', player }, ws)
      break
    }

    case 'leave_room': {
      const info = clientRooms.get(ws)
      if (!info) return
      handleDisconnect(ws)
      break
    }

    case 'toggle_ready': {
      const info = clientRooms.get(ws)
      if (!info) return
      const room = rooms.get(info.roomId)
      if (!room) return
      const player = room.players[info.playerId]
      if (!player) return
      player.isReady = !player.isReady
      broadcast(room.id, { type: 'room_updated', room })
      break
    }

    case 'start_game': {
      const info = clientRooms.get(ws)
      if (!info) return
      const room = rooms.get(info.roomId)
      if (!room) return
      if (info.playerId !== room.hostId) {
        send(ws, { type: 'error', message: 'Only the host can start the game' })
        return
      }
      if (Object.keys(room.players).length < 2) {
        send(ws, { type: 'error', message: 'Need at least 2 players' })
        return
      }
      room.state = 'playing'
      const seed = Math.floor(Math.random() * 1000000)
      broadcast(room.id, { type: 'game_started', seed })
      break
    }

    case 'game_action': {
      const info = clientRooms.get(ws)
      if (!info) return
      const room = rooms.get(info.roomId)
      if (!room || room.state !== 'playing') return
      broadcast(room.id, {
        type: 'game_action',
        action: message.action,
        payload: message.payload,
        fromPlayerId: info.playerId,
      }, ws)
      break
    }

    case 'chat': {
      const info = clientRooms.get(ws)
      if (!info) return
      const room = rooms.get(info.roomId)
      if (!room) return
      const player = room.players[info.playerId]
      if (!player) return
      broadcast(room.id, {
        type: 'chat',
        message: message.message,
        fromPlayerId: info.playerId,
        playerName: player.name,
      })
      break
    }
  }
}

function handleDisconnect(ws: WebSocket): void {
  const info = clientRooms.get(ws)
  if (!info) return

  const room = rooms.get(info.roomId)
  if (room) {
    delete room.players[info.playerId]
    if (Object.keys(room.players).length === 0) {
      rooms.delete(info.roomId)
    } else {
      if (room.hostId === info.playerId) {
        room.hostId = Object.keys(room.players)[0]
      }
      broadcast(room.id, { type: 'player_left', playerId: info.playerId })
      broadcast(room.id, { type: 'room_updated', room })
    }
  }
  clientRooms.delete(ws)
}

wss.on('connection', (ws) => {
  const pingInterval = setInterval(() => {
    send(ws, { type: 'ping' })
  }, 30000)

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage
      handleMessage(ws, message)
    } catch {
      send(ws, { type: 'error', message: 'Invalid message format' })
    }
  })

  ws.on('close', () => {
    clearInterval(pingInterval)
    handleDisconnect(ws)
  })
})

console.log(`WAR WebSocket server running on port ${PORT}`)
