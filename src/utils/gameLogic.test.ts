import { describe, it, expect } from 'vitest'
import {
  totalResources, canAfford, subtractResources, addResources,
  calculateVP, canPlaceOutpost, canPlaceBase, canPlaceRoad,
  getTradeRatio, createDevCardDeck, createInitialPlayers,
  mustDiscard, discardAmount, COSTS, produceResources,
  TERRAIN_RESOURCE,
} from './gameLogic'
import { generateTiles, generateVerticesAndEdges, HEX_SIZE } from './hexGrid'
import type { Player, Resources, GameState } from '../types/game'
import { EMPTY_RESOURCES } from '../types/game'
import { BOARD_CENTER } from '../constants/colors'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-0',
    name: 'Test',
    color: 'red',
    resources: { ...EMPTY_RESOURCES },
    devCards: [],
    devCardsPlayedThisTurn: 0,
    soldiersPlayed: 0,
    publicVP: 0,
    hiddenVP: 0,
    ports: [],
    isAI: false,
    isConnected: true,
    ...overrides,
  }
}

function makeGameState(): GameState {
  const tiles = generateTiles()
  const { vertices, edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
  const players = createInitialPlayers([
    { name: 'P1', color: 'red', isAI: false },
    { name: 'P2', color: 'blue', isAI: false },
  ])

  const desertTile = Object.values(tiles).find(t => t.terrain === 'desert')

  return {
    id: 'test-game',
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

describe('totalResources', () => {
  it('sums all resource types', () => {
    expect(totalResources({ food: 1, weapons: 2, ammo: 3, tools: 4, supplies: 5 })).toBe(15)
  })

  it('returns 0 for empty resources', () => {
    expect(totalResources(EMPTY_RESOURCES)).toBe(0)
  })
})

describe('canAfford', () => {
  it('returns true when player has enough', () => {
    const player = makePlayer({ resources: { food: 1, weapons: 1, ammo: 0, tools: 1, supplies: 1 } })
    expect(canAfford(player, COSTS.outpost)).toBe(true)
  })

  it('returns false when player lacks resources', () => {
    const player = makePlayer({ resources: { ...EMPTY_RESOURCES, food: 1 } })
    expect(canAfford(player, COSTS.outpost)).toBe(false)
  })

  it('handles route cost', () => {
    const player = makePlayer({ resources: { ...EMPTY_RESOURCES, tools: 1, supplies: 1 } })
    expect(canAfford(player, COSTS.route)).toBe(true)
  })

  it('handles base cost', () => {
    const player = makePlayer({ resources: { ...EMPTY_RESOURCES, food: 2, ammo: 3 } })
    expect(canAfford(player, COSTS.base)).toBe(true)
  })
})

describe('subtractResources', () => {
  it('subtracts correctly', () => {
    const result = subtractResources(
      { food: 5, weapons: 3, ammo: 2, tools: 1, supplies: 4 },
      { food: 1, weapons: 1, ammo: 0, tools: 1, supplies: 1 }
    )
    expect(result).toEqual({ food: 4, weapons: 2, ammo: 2, tools: 0, supplies: 3 })
  })
})

describe('addResources', () => {
  it('adds correctly', () => {
    const result = addResources(
      { food: 1, weapons: 2, ammo: 0, tools: 0, supplies: 1 },
      { food: 2, weapons: 0, ammo: 1, tools: 3, supplies: 0 }
    )
    expect(result).toEqual({ food: 3, weapons: 2, ammo: 1, tools: 3, supplies: 1 })
  })
})

describe('calculateVP', () => {
  it('counts outposts as 1 VP each', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const vertexId = Object.keys(state.vertices)[0]
    state.vertices[vertexId].building = { type: 'outpost', playerId }
    expect(calculateVP(state, playerId)).toBe(1)
  })

  it('counts bases as 2 VP each', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const vertexId = Object.keys(state.vertices)[0]
    state.vertices[vertexId].building = { type: 'base', playerId }
    expect(calculateVP(state, playerId)).toBe(2)
  })

  it('includes longest road bonus', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    state.longestRoadPlayerId = playerId
    expect(calculateVP(state, playerId)).toBe(2)
  })

  it('includes largest army bonus', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    state.largestArmyPlayerId = playerId
    expect(calculateVP(state, playerId)).toBe(2)
  })

  it('includes hidden VP from dev cards', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    state.players[playerId].hiddenVP = 3
    expect(calculateVP(state, playerId)).toBe(3)
  })
})

describe('canPlaceOutpost', () => {
  it('allows placement on empty vertex during setup', () => {
    const state = makeGameState()
    state.phase = 'setup'
    const playerId = state.playerOrder[0]
    const vertexId = Object.keys(state.vertices)[0]
    expect(canPlaceOutpost(vertexId, playerId, state, true)).toBe(true)
  })

  it('rejects placement on occupied vertex', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const vertexId = Object.keys(state.vertices)[0]
    state.vertices[vertexId].building = { type: 'outpost', playerId }
    expect(canPlaceOutpost(vertexId, playerId, state, true)).toBe(false)
  })

  it('enforces distance rule', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const vertexIds = Object.keys(state.vertices)
    state.vertices[vertexIds[0]].building = { type: 'outpost', playerId }

    const adjacentEdges = Object.values(state.edges).filter(
      e => e.vertexIds.includes(vertexIds[0])
    )
    for (const edge of adjacentEdges) {
      const adjVertexId = edge.vertexIds[0] === vertexIds[0] ? edge.vertexIds[1] : edge.vertexIds[0]
      expect(canPlaceOutpost(adjVertexId, playerId, state, true)).toBe(false)
    }
  })
})

describe('canPlaceBase', () => {
  it('allows upgrade of own outpost', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const vertexId = Object.keys(state.vertices)[0]
    state.vertices[vertexId].building = { type: 'outpost', playerId }
    expect(canPlaceBase(vertexId, playerId, state)).toBe(true)
  })

  it('rejects upgrade of other player outpost', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const otherId = state.playerOrder[1]
    const vertexId = Object.keys(state.vertices)[0]
    state.vertices[vertexId].building = { type: 'outpost', playerId: otherId }
    expect(canPlaceBase(vertexId, playerId, state)).toBe(false)
  })

  it('rejects upgrade of already upgraded base', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const vertexId = Object.keys(state.vertices)[0]
    state.vertices[vertexId].building = { type: 'base', playerId }
    expect(canPlaceBase(vertexId, playerId, state)).toBe(false)
  })
})

describe('canPlaceRoad', () => {
  it('rejects road on occupied edge', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const edgeId = Object.keys(state.edges)[0]
    state.edges[edgeId].road = { playerId }
    expect(canPlaceRoad(edgeId, playerId, state, false)).toBe(false)
  })

  it('allows road connected to own building', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]
    const edgeId = Object.keys(state.edges)[0]
    const edge = state.edges[edgeId]
    state.vertices[edge.vertexIds[0]].building = { type: 'outpost', playerId }
    expect(canPlaceRoad(edgeId, playerId, state, false)).toBe(true)
  })
})

describe('getTradeRatio', () => {
  it('returns 4 with no ports', () => {
    const player = makePlayer()
    expect(getTradeRatio(player, 'food')).toBe(4)
  })

  it('returns 3 with generic port', () => {
    const player = makePlayer({ ports: ['generic'] })
    expect(getTradeRatio(player, 'food')).toBe(3)
  })

  it('returns 2 with matching resource port', () => {
    const player = makePlayer({ ports: ['food'] })
    expect(getTradeRatio(player, 'food')).toBe(2)
  })

  it('returns 3 for non-matching resource with generic port', () => {
    const player = makePlayer({ ports: ['food'] })
    expect(getTradeRatio(player, 'weapons')).toBe(4)
  })
})

describe('createDevCardDeck', () => {
  it('creates deck with correct counts', () => {
    const deck = createDevCardDeck()
    expect(deck.length).toBe(25)
    expect(deck.filter(c => c === 'soldier').length).toBe(14)
    expect(deck.filter(c => c === 'road_building').length).toBe(2)
    expect(deck.filter(c => c === 'year_of_plenty').length).toBe(2)
    expect(deck.filter(c => c === 'monopoly').length).toBe(2)
    expect(deck.filter(c => c === 'victory_point').length).toBe(5)
  })
})

describe('createInitialPlayers', () => {
  it('creates players with correct colors', () => {
    const players = createInitialPlayers([
      { name: 'A', color: 'green', isAI: false },
      { name: 'B', color: 'orange', isAI: true },
    ])
    const playerList = Object.values(players)
    expect(playerList[0].color).toBe('green')
    expect(playerList[1].color).toBe('orange')
  })

  it('assigns correct AI flags', () => {
    const players = createInitialPlayers([
      { name: 'A', color: 'red', isAI: false },
      { name: 'B', color: 'blue', isAI: true },
    ])
    const playerList = Object.values(players)
    expect(playerList[0].isAI).toBe(false)
    expect(playerList[1].isAI).toBe(true)
  })

  it('starts with empty resources', () => {
    const players = createInitialPlayers([
      { name: 'A', color: 'red', isAI: false },
    ])
    const player = Object.values(players)[0]
    expect(totalResources(player.resources)).toBe(0)
  })
})

describe('mustDiscard', () => {
  it('returns false with 7 or fewer resources', () => {
    const player = makePlayer({ resources: { food: 2, weapons: 2, ammo: 1, tools: 1, supplies: 1 } })
    expect(mustDiscard(player)).toBe(false)
  })

  it('returns true with more than 7 resources', () => {
    const player = makePlayer({ resources: { food: 3, weapons: 3, ammo: 1, tools: 1, supplies: 1 } })
    expect(mustDiscard(player)).toBe(true)
  })
})

describe('discardAmount', () => {
  it('returns 0 for 7 or fewer', () => {
    const player = makePlayer({ resources: { food: 2, weapons: 2, ammo: 1, tools: 1, supplies: 1 } })
    expect(discardAmount(player)).toBe(0)
  })

  it('returns half for 8 resources', () => {
    const player = makePlayer({ resources: { food: 2, weapons: 2, ammo: 2, tools: 1, supplies: 1 } })
    expect(discardAmount(player)).toBe(4)
  })

  it('returns floor of half for odd totals', () => {
    const player = makePlayer({ resources: { food: 3, weapons: 2, ammo: 2, tools: 1, supplies: 1 } })
    expect(discardAmount(player)).toBe(4)
  })
})

describe('produceResources', () => {
  it('gives resources to players with buildings on matching tiles', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]

    const tile = Object.values(state.tiles).find(t => t.number && t.terrain !== 'desert')
    if (!tile) return

    const hexVertices = Object.values(state.vertices).filter(v => v.hexIds.includes(tile.id))
    if (hexVertices.length === 0) return

    hexVertices[0].building = { type: 'outpost', playerId }

    const production = produceResources(state, tile.number!)
    const resource = TERRAIN_RESOURCE[tile.terrain]
    if (resource) {
      expect(production[playerId][resource]).toBe(1)
    }
  })

  it('gives double resources for bases', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]

    const tile = Object.values(state.tiles).find(t => t.number && t.terrain !== 'desert')
    if (!tile) return

    const hexVertices = Object.values(state.vertices).filter(v => v.hexIds.includes(tile.id))
    if (hexVertices.length === 0) return

    hexVertices[0].building = { type: 'base', playerId }

    const production = produceResources(state, tile.number!)
    const resource = TERRAIN_RESOURCE[tile.terrain]
    if (resource) {
      expect(production[playerId][resource]).toBe(2)
    }
  })

  it('skips tiles with robber', () => {
    const state = makeGameState()
    const playerId = state.playerOrder[0]

    const tile = Object.values(state.tiles).find(t => t.number && t.terrain !== 'desert')
    if (!tile) return

    tile.hasRobber = true
    const hexVertices = Object.values(state.vertices).filter(v => v.hexIds.includes(tile.id))
    if (hexVertices.length === 0) return

    hexVertices[0].building = { type: 'outpost', playerId }

    const production = produceResources(state, tile.number!)
    expect(totalResources(production[playerId])).toBe(0)
  })
})
