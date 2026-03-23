import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { v4 as uuidv4 } from 'uuid'
import type { Room, RoomPlayer, ClientMessage, ServerMessage, PublicRoomInfo } from './types.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const PLAYER_COLORS = ['red', 'blue', 'green', 'orange']
const ROOM_TTL_MS = 4 * 60 * 60 * 1000
const MAX_ROOMS = 5000
const MAX_MESSAGE_SIZE = 4096

const rooms = new Map<string, Room>()
const clientRooms = new Map<WebSocket, { roomId: string; playerId: string }>()

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  if ([...rooms.values()].some(r => r.code === code)) {
    return generateRoomCode()
  }
  return code
}

function cleanupStaleRooms(): void {
  const now = Date.now()
  for (const [id, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(id)
    }
    if (Object.keys(room.players).length === 0) {
      rooms.delete(id)
    }
  }
}

function getNextColor(room: Room): string {
  const usedColors = new Set(Object.values(room.players).map(p => p.color))
  return PLAYER_COLORS.find(c => !usedColors.has(c)) ?? 'red'
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
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

function getPublicRoomList(): PublicRoomInfo[] {
  const list: PublicRoomInfo[] = []
  for (const room of rooms.values()) {
    if (room.isPrivate) continue
    if (room.state !== 'waiting') continue
    const playerCount = Object.keys(room.players).length
    if (playerCount >= room.maxPlayers) continue
    const host = room.players[room.hostId]
    list.push({
      id: room.id,
      code: room.code,
      hostName: host?.name ?? 'Unknown',
      playerCount,
      maxPlayers: room.maxPlayers,
      mapId: room.mapId,
    })
  }
  return list.slice(0, 50)
}

function addPlayerToRoom(ws: WebSocket, room: Room, playerName: string): void {
  const playerId = uuidv4()
  const player: RoomPlayer = {
    id: playerId,
    name: playerName.slice(0, 20),
    color: getNextColor(room),
    isAI: false,
    isConnected: true,
    isReady: false,
  }
  room.players[playerId] = player
  clientRooms.set(ws, { roomId: room.id, playerId })

  send(ws, { type: 'room_joined', room, playerId })
  broadcast(room.id, { type: 'player_joined', player }, ws)
}

function validateJoinable(room: Room | undefined): string | null {
  if (!room) return 'Room not found'
  if (Object.keys(room.players).length >= room.maxPlayers) return 'Room is full'
  if (room.state !== 'waiting') return 'Game already in progress'
  return null
}

function handleCreateRoom(ws: WebSocket, playerName: string, isPrivate: boolean, mapId: string): void {
  if (rooms.size >= MAX_ROOMS) {
    send(ws, { type: 'error', message: 'Server is full. Try again later.' })
    return
  }

  const playerId = uuidv4()
  const roomId = uuidv4()
  const code = generateRoomCode()
  const player: RoomPlayer = {
    id: playerId,
    name: playerName.slice(0, 20),
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
    isPrivate,
    mapId,
    createdAt: Date.now(),
  }
  rooms.set(roomId, room)
  clientRooms.set(ws, { roomId, playerId })
  send(ws, { type: 'room_created', room, playerId })
}

function handleJoinByCode(ws: WebSocket, roomCode: string, playerName: string): void {
  const room = [...rooms.values()].find(r => r.code === roomCode.toUpperCase())
  const err = validateJoinable(room)
  if (err || !room) {
    send(ws, { type: 'error', message: err ?? 'Room not found' })
    return
  }
  addPlayerToRoom(ws, room, playerName)
}

function handleJoinById(ws: WebSocket, roomId: string, playerName: string): void {
  const room = rooms.get(roomId)
  const err = validateJoinable(room)
  if (err || !room) {
    send(ws, { type: 'error', message: err ?? 'Room not found' })
    return
  }
  addPlayerToRoom(ws, room, playerName)
}

function handleToggleReady(ws: WebSocket): void {
  const info = clientRooms.get(ws)
  if (!info) return
  const room = rooms.get(info.roomId)
  if (!room) return
  const player = room.players[info.playerId]
  if (!player) return
  player.isReady = !player.isReady
  broadcast(room.id, { type: 'room_updated', room })
}

function handleStartGame(ws: WebSocket): void {
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
}

function handleGameAction(ws: WebSocket, action: string, payload: Record<string, unknown>): void {
  const info = clientRooms.get(ws)
  if (!info) return
  const room = rooms.get(info.roomId)
  if (!room || room.state !== 'playing') return
  broadcast(room.id, {
    type: 'game_action',
    action,
    payload,
    fromPlayerId: info.playerId,
  }, ws)
}

function handleChat(ws: WebSocket, message: string): void {
  const info = clientRooms.get(ws)
  if (!info) return
  const room = rooms.get(info.roomId)
  if (!room) return
  const player = room.players[info.playerId]
  if (!player) return
  broadcast(room.id, {
    type: 'chat',
    message: message.slice(0, 200),
    fromPlayerId: info.playerId,
    playerName: player.name,
  })
}

function handleMessage(ws: WebSocket, raw: string): void {
  if (raw.length > MAX_MESSAGE_SIZE) {
    send(ws, { type: 'error', message: 'Message too large' })
    return
  }

  let message: ClientMessage
  try {
    message = JSON.parse(raw) as ClientMessage
  } catch {
    send(ws, { type: 'error', message: 'Invalid message format' })
    return
  }

  switch (message.type) {
    case 'create_room':
      handleCreateRoom(ws, message.playerName, message.isPrivate, message.mapId ?? 'standard')
      break
    case 'join_room':
      handleJoinByCode(ws, message.roomCode, message.playerName)
      break
    case 'join_room_by_id':
      handleJoinById(ws, message.roomId, message.playerName)
      break
    case 'leave_room':
      handleDisconnect(ws)
      break
    case 'toggle_ready':
      handleToggleReady(ws)
      break
    case 'start_game':
      handleStartGame(ws)
      break
    case 'list_rooms':
      send(ws, { type: 'room_list', rooms: getPublicRoomList() })
      break
    case 'game_action':
      handleGameAction(ws, message.action, message.payload)
      break
    case 'chat':
      handleChat(ws, message.message)
      break
  }
}

function handleDisconnect(ws: WebSocket): void {
  const info = clientRooms.get(ws)
  if (!info) return

  const room = rooms.get(info.roomId)
  if (room) {
    const player = room.players[info.playerId]
    if (player && room.state === 'playing') {
      player.isConnected = false
      broadcast(room.id, { type: 'room_updated', room })
    } else {
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
  }
  clientRooms.delete(ws)
}

const httpServer = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*')

  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      rooms: rooms.size,
      connections: wss.clients.size,
      uptime: process.uptime(),
    }))
    return
  }

  if (req.url === '/stats') {
    const activeGames = [...rooms.values()].filter(r => r.state === 'playing').length
    const waitingRooms = [...rooms.values()].filter(r => r.state === 'waiting').length
    const totalPlayers = [...rooms.values()].reduce(
      (sum, r) => sum + Object.keys(r.players).length, 0
    )
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      activeGames,
      waitingRooms,
      totalPlayers,
      connections: wss.clients.size,
    }))
    return
  }

  if (req.url === '/rooms') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(getPublicRoomList()))
    return
  }

  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws) => {
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }, 30000)

  ws.on('pong', () => {})

  ws.on('message', (data) => {
    handleMessage(ws, data.toString())
  })

  ws.on('close', () => {
    clearInterval(pingInterval)
    handleDisconnect(ws)
  })
})

setInterval(cleanupStaleRooms, 60000)

httpServer.listen(PORT, () => {
  console.log(`war server listening on port ${PORT}`)
})
