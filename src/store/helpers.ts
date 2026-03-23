import type { GameState, ResourceType } from '../types/game'
import { calculateLongestRoad, calculateVP, addLog, totalResources } from '../utils/gameLogic'

export function nextPlayerIndex(state: GameState): number {
  return (state.currentPlayerIndex + 1) % state.playerOrder.length
}

export function updateLongestRoad(state: GameState): void {
  let bestPlayer: string | null = null
  let bestLength = 4

  for (const playerId of state.playerOrder) {
    const len = calculateLongestRoad(playerId, state.vertices, state.edges)
    if (len >= 5 && len > bestLength) {
      bestLength = len
      bestPlayer = playerId
    }
  }

  if (bestPlayer) {
    state.longestRoadPlayerId = bestPlayer
    state.longestRoadLength = bestLength
  } else if (state.longestRoadPlayerId) {
    const currentLen = calculateLongestRoad(state.longestRoadPlayerId, state.vertices, state.edges)
    if (currentLen < 5) {
      state.longestRoadPlayerId = null
      state.longestRoadLength = 4
    }
  }
}

export function updateLargestArmy(state: GameState): void {
  for (const playerId of state.playerOrder) {
    const soldiers = state.players[playerId].soldiersPlayed
    if (soldiers >= 3 && soldiers > state.largestArmySize) {
      state.largestArmySize = soldiers
      state.largestArmyPlayerId = playerId
    }
  }
}

export function checkWinner(state: GameState): void {
  for (const playerId of state.playerOrder) {
    const vp = calculateVP(state, playerId)
    if (vp >= 10) {
      state.winner = playerId
      state.phase = 'game_over'
    }
  }
}

export function grantPortAccess(state: GameState, edgeId: string, playerId: string): void {
  state.edges[edgeId].vertexIds.forEach(vId => {
    const v = state.vertices[vId]
    if (v.portType && !state.players[playerId].ports.includes(v.portType)) {
      state.players[playerId].ports.push(v.portType)
    }
  })
}

export function stealRandomResource(state: GameState, thiefId: string, victimId: string): void {
  const resources = (Object.entries(state.players[victimId].resources) as [ResourceType, number][])
    .filter(([, count]) => count > 0)
    .map(([res]) => res)
  if (resources.length === 0) return

  const stolen = resources[Math.floor(Math.random() * resources.length)]
  state.players[victimId].resources[stolen] -= 1
  state.players[thiefId].resources[stolen] += 1
  state.log.push(addLog(
    state,
    `${state.players[thiefId].name} stole 1 resource from ${state.players[victimId].name}`,
    thiefId
  ))
}

export function findStealTargets(state: GameState, tileId: string, currentPlayerId: string): Set<string> {
  const targets = new Set<string>()
  const adjVertices = Object.values(state.vertices).filter(v => v.hexIds.includes(tileId))
  for (const v of adjVertices) {
    if (v.building && v.building.playerId !== currentPlayerId) {
      if (totalResources(state.players[v.building.playerId].resources) > 0) {
        targets.add(v.building.playerId)
      }
    }
  }
  return targets
}

export function advanceSetup(
  state: GameState,
  ui: { setupOutpostVertexId: string | null }
): void {
  const playerCount = state.playerOrder.length
  const idx = state.currentPlayerIndex

  if (state.setupRound === 1) {
    if (idx < playerCount - 1) {
      state.currentPlayerIndex = idx + 1
      state.setupSubPhase = 'place_outpost'
    } else {
      state.setupRound = 2
      state.setupSubPhase = 'place_outpost'
    }
  } else {
    if (idx > 0) {
      state.currentPlayerIndex = idx - 1
      state.setupSubPhase = 'place_outpost'
    } else {
      state.phase = 'playing'
      state.setupSubPhase = 'place_outpost'
      state.currentPlayerIndex = 0
      state.log.push(addLog(state, 'Setup complete. Game begins. Roll dice to start your turn.'))
    }
  }
  ui.setupOutpostVertexId = null
}

export const BUILDING_LIMITS = {
  outpost: 5,
  base: 4,
  route: 15,
} as const

export function countPlayerBuildings(state: GameState, playerId: string): { outposts: number; bases: number; routes: number } {
  let outposts = 0
  let bases = 0
  let routes = 0

  for (const vertex of Object.values(state.vertices)) {
    if (vertex.building?.playerId === playerId) {
      if (vertex.building.type === 'outpost') outposts++
      else bases++
    }
  }

  for (const edge of Object.values(state.edges)) {
    if (edge.road?.playerId === playerId) routes++
  }

  return { outposts, bases, routes }
}
