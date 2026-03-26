import type {
  GameState, Player, Resources, ResourceType, DevCardType,
  Vertex, Edge, HexTile, TerrainType, PortType, GameLog, PlayerColor,
} from '../types/game'
import { EMPTY_RESOURCES } from '../types/game'
import {
  getAdjacentVertices, getVertexEdges, otherVertex, getHexVertices, shuffle,
} from './hexGrid'

export function totalResources(r: Resources): number {
  return r.food + r.weapons + r.ammo + r.tools + r.supplies
}

export function canAfford(player: Player, cost: Resources): boolean {
  return (
    player.resources.food >= cost.food &&
    player.resources.weapons >= cost.weapons &&
    player.resources.ammo >= cost.ammo &&
    player.resources.tools >= cost.tools &&
    player.resources.supplies >= cost.supplies
  )
}

export function subtractResources(r: Resources, cost: Resources): Resources {
  return {
    food: r.food - cost.food,
    weapons: r.weapons - cost.weapons,
    ammo: r.ammo - cost.ammo,
    tools: r.tools - cost.tools,
    supplies: r.supplies - cost.supplies,
  }
}

export function addResources(a: Resources, b: Resources): Resources {
  return {
    food: a.food + b.food,
    weapons: a.weapons + b.weapons,
    ammo: a.ammo + b.ammo,
    tools: a.tools + b.tools,
    supplies: a.supplies + b.supplies,
  }
}

export const COSTS = {
  route: { ...EMPTY_RESOURCES, tools: 1, supplies: 1 },
  outpost: { ...EMPTY_RESOURCES, tools: 1, supplies: 1, food: 1, weapons: 1 },
  base: { ...EMPTY_RESOURCES, food: 2, ammo: 3 },
  devCard: { ...EMPTY_RESOURCES, supplies: 1, food: 1, ammo: 1 },
} as const

export function calculateVP(state: GameState, playerId: string): number {
  const player = state.players[playerId]
  let vp = 0

  for (const vertex of Object.values(state.vertices)) {
    if (vertex.building?.playerId === playerId) {
      vp += vertex.building.type === 'outpost' ? 1 : 2
    }
  }

  if (state.longestRoadPlayerId === playerId) vp += 2
  if (state.largestArmyPlayerId === playerId) vp += 2

  vp += player.hiddenVP

  return vp
}

export function calculateLongestRoad(
  playerId: string,
  vertices: Record<string, Vertex>,
  edges: Record<string, Edge>
): number {
  const playerEdges = Object.values(edges).filter(e => e.road?.playerId === playerId)
  if (playerEdges.length === 0) return 0

  let maxLen = 0

  for (const startEdge of playerEdges) {
    for (const startVertex of startEdge.vertexIds) {
      const len = dfsRoad(playerId, startVertex, null, new Set(), vertices, edges)
      maxLen = Math.max(maxLen, len)
    }
  }

  return maxLen
}

function dfsRoad(
  playerId: string,
  vertexId: string,
  fromEdgeId: string | null,
  visited: Set<string>,
  vertices: Record<string, Vertex>,
  edges: Record<string, Edge>
): number {
  let max = 0

  const connectedEdges = getVertexEdges(vertexId, edges).filter(
    e => e.road?.playerId === playerId && e.id !== fromEdgeId
  )

  for (const edge of connectedEdges) {
    if (visited.has(edge.id)) continue

    const vertex = vertices[vertexId]
    if (vertex.building && vertex.building.playerId !== playerId && fromEdgeId !== null) {
      continue
    }

    visited.add(edge.id)
    const nextVertex = otherVertex(edge, vertexId)
    const len = 1 + dfsRoad(playerId, nextVertex, edge.id, visited, vertices, edges)
    max = Math.max(max, len)
    visited.delete(edge.id)
  }

  return max
}

export function canPlaceOutpost(
  vertexId: string,
  playerId: string,
  state: GameState,
  isSetup: boolean
): boolean {
  const vertex = state.vertices[vertexId]
  if (!vertex) return false
  if (vertex.building) return false

  const adjacent = getAdjacentVertices(vertexId, state.edges)
  for (const adjId of adjacent) {
    if (state.vertices[adjId]?.building) return false
  }

  if (isSetup) return true

  const adjEdges = getVertexEdges(vertexId, state.edges)
  return adjEdges.some(e => e.road?.playerId === playerId)
}

export function canPlaceBase(
  vertexId: string,
  playerId: string,
  state: GameState
): boolean {
  const vertex = state.vertices[vertexId]
  if (!vertex) return false
  return vertex.building?.playerId === playerId && vertex.building?.type === 'outpost'
}

export function canPlaceRoad(
  edgeId: string,
  playerId: string,
  state: GameState,
  isSetup: boolean,
  setupVertexId?: string
): boolean {
  const edge = state.edges[edgeId]
  if (!edge) return false
  if (edge.road) return false

  if (isSetup && setupVertexId) {
    return edge.vertexIds.includes(setupVertexId)
  }

  for (const vId of edge.vertexIds) {
    const vertex = state.vertices[vId]
    if (vertex.building?.playerId === playerId) return true
    const adjEdges = getVertexEdges(vId, state.edges)
    const hasOwnRoad = adjEdges.some(e => e.id !== edgeId && e.road?.playerId === playerId)
    const blockedByOpponent = vertex.building && vertex.building.playerId !== playerId
    if (hasOwnRoad && !blockedByOpponent) return true
  }

  return false
}

export const TERRAIN_RESOURCE: Record<TerrainType, ResourceType | null> = {
  food: 'food',
  weapons: 'weapons',
  ammo: 'ammo',
  tools: 'tools',
  supplies: 'supplies',
  desert: null,
}

export function produceResources(
  state: GameState,
  roll: number
): Record<string, Resources> {
  const production: Record<string, Resources> = {}

  for (const playerId of state.playerOrder) {
    production[playerId] = { ...EMPTY_RESOURCES }
  }

  for (const tile of Object.values(state.tiles)) {
    if (tile.number !== roll) continue
    if (tile.hasRobber) continue

    const resource = TERRAIN_RESOURCE[tile.terrain]
    if (!resource) continue

    const hexVerts = getHexVertices(tile.id, state.vertices)
    for (const vertex of hexVerts) {
      if (!vertex.building) continue
      const { playerId, type } = vertex.building
      const amount = type === 'base' ? 2 : 1
      production[playerId][resource] += amount
    }
  }

  return production
}

export function getTradeRatio(player: Player, resource: ResourceType): number {
  if (player.ports.includes(resource as PortType)) return 2
  if (player.ports.includes('generic')) return 3
  return 4
}

export function createDevCardDeck(): DevCardType[] {
  const deck: DevCardType[] = [
    ...Array(14).fill('soldier'),
    ...Array(2).fill('road_building'),
    ...Array(2).fill('year_of_plenty'),
    ...Array(2).fill('monopoly'),
    ...Array(5).fill('victory_point'),
  ]
  return shuffle(deck)
}

export function createInitialPlayers(
  playerConfigs: Array<{ name: string; color: PlayerColor; isAI: boolean }>
): Record<string, Player> {
  const players: Record<string, Player> = {}

  playerConfigs.forEach((config, i) => {
    const id = `player-${i}`
    players[id] = {
      id,
      name: config.name,
      color: config.color,
      resources: { ...EMPTY_RESOURCES },
      devCards: [],
      devCardsPlayedThisTurn: 0,
      soldiersPlayed: 0,
      publicVP: 0,
      hiddenVP: 0,
      ports: [],
      isAI: config.isAI,
      isConnected: true,
    }
  })

  return players
}

export function assignPorts(
  vertices: Record<string, Vertex>,
  edges: Record<string, Edge>,
  _tiles: Record<string, HexTile>
): Record<string, Vertex> {
  const borderEdges = Object.values(edges).filter(e => {
    const va = vertices[e.vertexIds[0]]
    const vb = vertices[e.vertexIds[1]]
    if (!va || !vb) return false
    const sharedHex = va.hexIds.some(h => vb.hexIds.includes(h))
    const isBorder = va.hexIds.length <= 2 && vb.hexIds.length <= 2
    return sharedHex && isBorder
  })

  const midAngle = (e: Edge) => {
    const va = vertices[e.vertexIds[0]]
    const vb = vertices[e.vertexIds[1]]
    const mx = (va.position.x + vb.position.x) / 2
    const my = (va.position.y + vb.position.y) / 2
    return Math.atan2(my - 300, mx - 350)
  }

  borderEdges.sort((a, b) => midAngle(a) - midAngle(b))

  const portTypes: PortType[] = ['food', 'weapons', 'ammo', 'tools', 'supplies', 'generic', 'generic', 'generic', 'generic']
  const shuffledPorts = shuffle(portTypes)

  const updated = { ...vertices }
  const portCount = shuffledPorts.length
  const spacing = Math.max(1, Math.floor(borderEdges.length / portCount))

  for (let p = 0; p < portCount; p++) {
    const edgeIdx = (p * spacing) % borderEdges.length
    const edge = borderEdges[edgeIdx]
    const portType = shuffledPorts[p]
    updated[edge.vertexIds[0]] = { ...updated[edge.vertexIds[0]], portType }
    updated[edge.vertexIds[1]] = { ...updated[edge.vertexIds[1]], portType }
  }

  return updated
}

export function addLog(state: GameState, message: string, playerId?: string): GameLog {
  return {
    id: `log-${Date.now()}-${Math.random()}`,
    turn: state.turn,
    timestamp: Date.now(),
    message,
    playerId,
  }
}

export function mustDiscard(player: Player): boolean {
  return totalResources(player.resources) > 7
}

export function discardAmount(player: Player): number {
  const total = totalResources(player.resources)
  return total > 7 ? Math.floor(total / 2) : 0
}
