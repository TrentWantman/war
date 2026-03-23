import type { GameState, ResourceType } from '../types/game'
import {
  COSTS, canAfford, canPlaceOutpost, canPlaceRoad,
  calculateVP, getTradeRatio, totalResources,
} from './gameLogic'
import { getHexVertices } from './hexGrid'

export type AIAction =
  | { type: 'roll' }
  | { type: 'end_turn' }
  | { type: 'build_route'; edgeId: string }
  | { type: 'build_outpost'; vertexId: string }
  | { type: 'build_base'; vertexId: string }
  | { type: 'buy_dev_card' }
  | { type: 'bank_trade'; giving: ResourceType; receiving: ResourceType }
  | { type: 'setup_outpost'; vertexId: string }
  | { type: 'setup_route'; edgeId: string }
  | { type: 'play_soldier' }
  | { type: 'play_road_building' }

function scoreVertex(vertexId: string, state: GameState): number {
  const vertex = state.vertices[vertexId]
  let score = 0

  for (const hexId of vertex.hexIds) {
    const tile = state.tiles[hexId]
    if (!tile || tile.terrain === 'desert' || !tile.number) continue

    // Probability score: 6 and 8 are best at 5/36
    const num = tile.number
    const pip = num <= 7 ? num - 1 : 13 - num
    score += pip * 3

    // Bonus for resource diversity
    score += 5
  }

  if (vertex.portType) score += 15

  return score
}

function scoreResourceNeed(state: GameState, playerId: string): Record<ResourceType, number> {
  const player = state.players[playerId]
  const res = player.resources
  const scores: Record<ResourceType, number> = {
    food: 0, weapons: 0, ammo: 0, tools: 0, supplies: 0,
  }

  const buildPriority = getBuildPriority(state, playerId)

  if (buildPriority === 'outpost') {
    scores.tools += 3; scores.supplies += 3; scores.food += 3; scores.weapons += 3
    scores.tools -= res.tools; scores.supplies -= res.supplies
    scores.food -= res.food; scores.weapons -= res.weapons
  } else if (buildPriority === 'base') {
    scores.food += 4; scores.ammo += 4
    scores.food -= res.food * 0.5; scores.ammo -= res.ammo * 0.3
  } else if (buildPriority === 'route') {
    scores.tools += 2; scores.supplies += 2
    scores.tools -= res.tools; scores.supplies -= res.supplies
  } else {
    scores.ammo += 2; scores.food += 1; scores.supplies += 1
  }

  for (const k of Object.keys(scores) as ResourceType[]) {
    scores[k] = Math.max(0, scores[k])
  }

  return scores
}

function getBuildPriority(state: GameState, playerId: string): 'outpost' | 'base' | 'route' | 'dev' {
  const vp = calculateVP(state, playerId)
  const player = state.players[playerId]

  const outpostCount = Object.values(state.vertices).filter(
    v => v.building?.playerId === playerId && v.building.type === 'outpost'
  ).length
  const roadCount = Object.values(state.edges).filter(
    e => e.road?.playerId === playerId
  ).length

  if (vp >= 7 && outpostCount > 0) return 'base'
  if (outpostCount < 3 && roadCount >= outpostCount + 1) return 'outpost'
  if (roadCount < 5 || (roadCount < 10 && player.resources.tools > 0)) return 'route'
  if (outpostCount > 0) return 'base'
  return 'dev'
}

export function getAIAction(state: GameState, playerId: string): AIAction | null {
  const { phase, setupSubPhase } = state

  if (phase === 'setup') {
    if (setupSubPhase === 'place_outpost') return getSetupOutpostAction(state, playerId)
    if (setupSubPhase === 'place_route') return getSetupRouteAction(state, playerId)
    return null
  }

  if (phase !== 'playing') return null

  const player = state.players[playerId]

  if (!state.hasRolled) {
    if (!state.devCardPlayedThisTurn && player.devCards.includes('soldier')) {
      return { type: 'play_soldier' }
    }
    return { type: 'roll' }
  }

  const devAction = considerDevCard(state, playerId)
  if (devAction) return devAction

  const tradeAction = considerTrade(state, playerId)
  if (tradeAction) return tradeAction

  const buildAction = considerBuild(state, playerId)
  if (buildAction) return buildAction

  return { type: 'end_turn' }
}

function getSetupOutpostAction(state: GameState, playerId: string): AIAction | null {
  const validVertices = Object.keys(state.vertices).filter(id =>
    canPlaceOutpost(id, playerId, state, true)
  )
  if (validVertices.length === 0) return null

  const scored = validVertices.map(id => ({ id, score: scoreVertex(id, state) }))
  scored.sort((a, b) => b.score - a.score)

  return { type: 'setup_outpost', vertexId: scored[0].id }
}

function getSetupRouteAction(state: GameState, playerId: string): AIAction | null {
  const myVertices = Object.values(state.vertices).filter(
    v => v.building?.playerId === playerId
  )
  if (myVertices.length === 0) return null

  // Find the outpost that doesn't have an adjacent road yet (the one just placed)
  for (const vertex of myVertices) {
    const adjEdges = Object.values(state.edges).filter(
      e => e.vertexIds.includes(vertex.id)
    )
    if (adjEdges.some(e => e.road?.playerId === playerId)) continue
    const available = adjEdges.filter(e => !e.road)
    if (available.length > 0) {
      return { type: 'setup_route', edgeId: available[0].id }
    }
  }
  return null
}

function considerTrade(state: GameState, playerId: string): AIAction | null {
  const player = state.players[playerId]
  const needs = scoreResourceNeed(state, playerId)

  const resources: ResourceType[] = ['food', 'weapons', 'ammo', 'tools', 'supplies']

  const sortedNeeds = resources
    .filter(r => needs[r] > 0)
    .sort((a, b) => needs[b] - needs[a])

  for (const receiving of sortedNeeds) {
    if (player.resources[receiving] >= 3) continue

    const giving = resources
      .filter(r => r !== receiving && player.resources[r] >= getTradeRatio(player, r))
      .sort((a, b) => player.resources[b] - player.resources[a])[0]

    if (giving) {
      return { type: 'bank_trade', giving, receiving }
    }
  }

  return null
}

function considerDevCard(state: GameState, playerId: string): AIAction | null {
  if (state.devCardPlayedThisTurn) return null
  const player = state.players[playerId]

  if (player.devCards.includes('road_building')) {
    const validRoutes = Object.keys(state.edges).filter(id =>
      canPlaceRoad(id, playerId, state, false)
    )
    if (validRoutes.length >= 2) {
      return { type: 'play_road_building' }
    }
  }

  if (player.devCards.includes('soldier')) {
    return { type: 'play_soldier' }
  }

  return null
}

function considerBuild(state: GameState, playerId: string): AIAction | null {
  const player = state.players[playerId]
  const priority = getBuildPriority(state, playerId)

  if (priority === 'base') {
    const validBases = Object.keys(state.vertices).filter(id => {
      const v = state.vertices[id]
      return v.building?.playerId === playerId && v.building.type === 'outpost'
    })
    if (validBases.length > 0 && canAfford(player, COSTS.base)) {
      return { type: 'build_base', vertexId: validBases[0] }
    }
  }

  if (priority === 'outpost' || priority === 'base') {
    const validOutposts = Object.keys(state.vertices).filter(id =>
      canPlaceOutpost(id, playerId, state, false)
    )
    if (validOutposts.length > 0 && canAfford(player, COSTS.outpost)) {
      const scored = validOutposts.map(id => ({ id, score: scoreVertex(id, state) }))
      scored.sort((a, b) => b.score - a.score)
      return { type: 'build_outpost', vertexId: scored[0].id }
    }
  }

  if (priority === 'route') {
    const validRoutes = Object.keys(state.edges).filter(id =>
      canPlaceRoad(id, playerId, state, false)
    )
    if (validRoutes.length > 0 && canAfford(player, COSTS.route)) {
      return { type: 'build_route', edgeId: validRoutes[0] }
    }
  }

  if (canAfford(player, COSTS.devCard) && state.devCardDeck.length > 0) {
    return { type: 'buy_dev_card' }
  }

  return null
}

export function getAIRobberTile(state: GameState, playerId: string): string {
  const tiles = Object.values(state.tiles).filter(
    t => !t.hasRobber && t.terrain !== 'desert' && t.id !== state.robberTileId
  )

  let bestTile = tiles[0]?.id ?? Object.keys(state.tiles)[0]
  let bestScore = -1

  for (const tile of tiles) {
    let score = 0
    const verts = getHexVertices(tile.id, state.vertices)
    for (const v of verts) {
      if (v.building && v.building.playerId !== playerId) {
        const num = tile.number ?? 0
        const pip = num <= 7 ? num - 1 : 13 - num
        score += pip * (v.building.type === 'base' ? 2 : 1)
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestTile = tile.id
    }
  }

  return bestTile
}

export function getAIDiscardSelection(state: GameState, playerId: string): Partial<Record<ResourceType, number>> {
  const player = state.players[playerId]
  const needed = Math.floor(totalResources(player.resources) / 2)
  const selection: Partial<Record<ResourceType, number>> = {}
  let remaining = needed

  const needs = scoreResourceNeed(state, playerId)
  const resources: ResourceType[] = ['food', 'weapons', 'ammo', 'tools', 'supplies']

  // Discard resources we need least first
  const sorted = resources
    .filter(r => player.resources[r] > 0)
    .sort((a, b) => needs[a] - needs[b])

  for (const r of sorted) {
    if (remaining <= 0) break
    const discard = Math.min(player.resources[r], remaining)
    if (discard > 0) {
      selection[r] = discard
      remaining -= discard
    }
  }

  return selection
}
