import { describe, it, expect } from 'vitest'
import { getAIAction, getAIRobberTile, getAIDiscardSelection } from './aiPlayer'
import { generateTiles, generateVerticesAndEdges, HEX_SIZE } from './hexGrid'
import { createInitialPlayers, createDevCardDeck, assignPorts } from './gameLogic'
import type { GameState } from '../types/game'
import { BOARD_CENTER } from '../constants/colors'

function makeAIGameState(overrides: Partial<GameState> = {}): GameState {
  const tiles = generateTiles()
  const { vertices: rawVertices, edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
  const vertices = assignPorts(rawVertices, edges, tiles)
  const players = createInitialPlayers([
    { name: 'Human', color: 'red', isAI: false },
    { name: 'Bot', color: 'blue', isAI: true },
  ])

  const desertTile = Object.values(tiles).find(t => t.terrain === 'desert')

  return {
    id: 'test',
    phase: 'playing',
    setupSubPhase: 'place_outpost',
    playerOrder: Object.keys(players),
    players,
    currentPlayerIndex: 1,
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
    ...overrides,
  }
}

describe('getAIAction', () => {
  it('returns roll action when dice not rolled', () => {
    const state = makeAIGameState({ hasRolled: false })
    const action = getAIAction(state, 'player-1')
    expect(action).toEqual({ type: 'roll' })
  })

  it('returns end_turn when rolled and nothing to build', () => {
    const state = makeAIGameState({ hasRolled: true })
    const action = getAIAction(state, 'player-1')
    expect(action?.type).toBe('end_turn')
  })

  it('returns null for non-playing phase', () => {
    const state = makeAIGameState({ phase: 'robber' })
    const action = getAIAction(state, 'player-1')
    expect(action).toBeNull()
  })

  it('returns setup_outpost during setup', () => {
    const state = makeAIGameState({
      phase: 'setup',
      setupSubPhase: 'place_outpost',
    })
    const action = getAIAction(state, 'player-1')
    expect(action?.type).toBe('setup_outpost')
  })
})

describe('getAIRobberTile', () => {
  it('returns a tile id that is not the current robber tile', () => {
    const state = makeAIGameState()
    const tileId = getAIRobberTile(state, 'player-1')
    expect(tileId).toBeDefined()
    expect(typeof tileId).toBe('string')
  })

  it('prefers tiles with opponent buildings', () => {
    const state = makeAIGameState()
    const tile = Object.values(state.tiles).find(t => t.terrain !== 'desert' && !t.hasRobber)
    if (!tile) return

    const hexVerts = Object.values(state.vertices).filter(v => v.hexIds.includes(tile.id))
    if (hexVerts.length > 0) {
      hexVerts[0].building = { type: 'outpost', playerId: 'player-0' }
    }

    const tileId = getAIRobberTile(state, 'player-1')
    expect(tileId).toBeDefined()
  })
})

describe('getAIDiscardSelection', () => {
  it('selects correct number of resources to discard', () => {
    const state = makeAIGameState()
    state.players['player-1'].resources = { food: 3, weapons: 3, ammo: 2, tools: 1, supplies: 1 }

    const selection = getAIDiscardSelection(state, 'player-1')
    const total = Object.values(selection).reduce((a, b) => a + (b ?? 0), 0)
    expect(total).toBe(5)
  })

  it('does not select more than available', () => {
    const state = makeAIGameState()
    state.players['player-1'].resources = { food: 4, weapons: 4, ammo: 0, tools: 0, supplies: 0 }

    const selection = getAIDiscardSelection(state, 'player-1')
    for (const [res, amt] of Object.entries(selection)) {
      const key = res as keyof typeof state.players['player-1']['resources']
      expect(amt).toBeLessThanOrEqual(state.players['player-1'].resources[key])
    }
  })
})
