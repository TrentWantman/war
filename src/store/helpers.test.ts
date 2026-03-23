import { describe, it, expect } from 'vitest'
import {
  nextPlayerIndex, countPlayerBuildings, BUILDING_LIMITS,
  findStealTargets,
} from './helpers'
import { generateTiles, generateVerticesAndEdges, HEX_SIZE } from '../utils/hexGrid'
import { createInitialPlayers, createDevCardDeck, assignPorts } from '../utils/gameLogic'
import type { GameState } from '../types/game'
import { BOARD_CENTER } from '../constants/colors'

function makeTestState(): GameState {
  const tiles = generateTiles()
  const { vertices: rawVertices, edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
  const vertices = assignPorts(rawVertices, edges, tiles)
  const players = createInitialPlayers([
    { name: 'P1', color: 'red', isAI: false },
    { name: 'P2', color: 'blue', isAI: false },
  ])

  const desertTile = Object.values(tiles).find(t => t.terrain === 'desert')

  return {
    id: 'test',
    phase: 'playing',
    setupSubPhase: 'place_outpost',
    playerOrder: Object.keys(players),
    players,
    currentPlayerIndex: 0,
    setupRound: 1,
    tiles,
    vertices,
    edges,
    ports: [],
    devCardDeck: createDevCardDeck(),
    lastRoll: null,
    hasRolled: false,
    devCardPlayedThisTurn: false,
    activeTrade: null,
    longestRoadPlayerId: null,
    longestRoadLength: 4,
    largestArmyPlayerId: null,
    largestArmySize: 2,
    turn: 1,
    winner: null,
    log: [],
    freeRoadsRemaining: 0,
    robberTileId: desertTile?.id ?? Object.keys(tiles)[0],
  }
}

describe('nextPlayerIndex', () => {
  it('wraps around to 0', () => {
    const state = makeTestState()
    state.currentPlayerIndex = 1
    expect(nextPlayerIndex(state)).toBe(0)
  })

  it('advances normally', () => {
    const state = makeTestState()
    state.currentPlayerIndex = 0
    expect(nextPlayerIndex(state)).toBe(1)
  })
})

describe('countPlayerBuildings', () => {
  it('counts outposts correctly', () => {
    const state = makeTestState()
    const playerId = state.playerOrder[0]
    const vertexIds = Object.keys(state.vertices)
    state.vertices[vertexIds[0]].building = { type: 'outpost', playerId }
    state.vertices[vertexIds[5]].building = { type: 'outpost', playerId }

    const counts = countPlayerBuildings(state, playerId)
    expect(counts.outposts).toBe(2)
    expect(counts.bases).toBe(0)
  })

  it('counts bases correctly', () => {
    const state = makeTestState()
    const playerId = state.playerOrder[0]
    const vertexIds = Object.keys(state.vertices)
    state.vertices[vertexIds[0]].building = { type: 'base', playerId }

    const counts = countPlayerBuildings(state, playerId)
    expect(counts.bases).toBe(1)
  })

  it('counts routes correctly', () => {
    const state = makeTestState()
    const playerId = state.playerOrder[0]
    const edgeIds = Object.keys(state.edges)
    state.edges[edgeIds[0]].road = { playerId }
    state.edges[edgeIds[1]].road = { playerId }
    state.edges[edgeIds[2]].road = { playerId }

    const counts = countPlayerBuildings(state, playerId)
    expect(counts.routes).toBe(3)
  })
})

describe('BUILDING_LIMITS', () => {
  it('has correct limits', () => {
    expect(BUILDING_LIMITS.outpost).toBe(5)
    expect(BUILDING_LIMITS.base).toBe(4)
    expect(BUILDING_LIMITS.route).toBe(15)
  })
})

describe('findStealTargets', () => {
  it('returns empty set when no buildings on tile', () => {
    const state = makeTestState()
    const tileId = Object.keys(state.tiles)[0]
    const targets = findStealTargets(state, tileId, state.playerOrder[0])
    expect(targets.size).toBe(0)
  })

  it('excludes the current player', () => {
    const state = makeTestState()
    const playerId = state.playerOrder[0]
    const tileId = Object.keys(state.tiles)[0]

    const hexVerts = Object.values(state.vertices).filter(v => v.hexIds.includes(tileId))
    if (hexVerts.length > 0) {
      hexVerts[0].building = { type: 'outpost', playerId }
      state.players[playerId].resources.food = 3
    }

    const targets = findStealTargets(state, tileId, playerId)
    expect(targets.has(playerId)).toBe(false)
  })
})
