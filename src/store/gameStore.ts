import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  GameState, Player, Resources, ResourceType, DevCardType,
  PlayerColor,
} from '../types/game'
import { EMPTY_RESOURCES } from '../types/game'
import { BOARD_CENTER } from '../constants/colors'
import { generateTiles, generateVerticesAndEdges, HEX_SIZE } from '../utils/hexGrid'
import {
  COSTS, canAfford, subtractResources, addResources,
  produceResources, calculateLongestRoad, calculateVP,
  createDevCardDeck, createInitialPlayers, addLog, mustDiscard, discardAmount,
  canPlaceOutpost, canPlaceBase, canPlaceRoad, getTradeRatio, assignPorts,
  totalResources, TERRAIN_RESOURCE,
} from '../utils/gameLogic'

interface LobbyPlayer {
  name: string
  isAI: boolean
  color: PlayerColor
}

interface GameStore {
  lobbyPlayers: LobbyPlayer[]
  setupOutpostVertexId: string | null
  hoveredVertexId: string | null
  hoveredEdgeId: string | null
  showBuildMenu: boolean
  showTradeMenu: boolean
  showDevCardMenu: boolean
  showDiscardMenu: boolean
  discardTarget: string | null
  discardSelections: Resources
  yearOfPlentySelections: ResourceType[]
  game: GameState | null

  setLobbyPlayers: (players: LobbyPlayer[]) => void
  startGame: () => void

  hoverVertex: (id: string | null) => void
  hoverEdge: (id: string | null) => void
  clickVertex: (id: string) => void
  clickEdge: (id: string) => void
  clickTile: (id: string) => void

  rollDice: () => void
  endTurn: () => void

  buildRoute: (edgeId: string) => void
  buildOutpost: (vertexId: string) => void
  buildBase: (vertexId: string) => void
  buyDevCard: () => void

  playDevCard: (type: DevCardType) => void
  chooseMonopolyResource: (resource: ResourceType) => void
  chooseYearOfPlentyResource: (resource: ResourceType) => void
  confirmYearOfPlenty: () => void

  bankTrade: (giving: ResourceType, receiving: ResourceType) => void

  moveRobber: (tileId: string) => void
  stealResource: (fromPlayerId: string) => void

  updateDiscardSelection: (resource: ResourceType, delta: number) => void
  confirmDiscard: () => void

  toggleBuildMenu: (open?: boolean) => void
  toggleTradeMenu: (open?: boolean) => void
  toggleDevCardMenu: (open?: boolean) => void

  getValidOutpostVertices: () => string[]
  getValidBaseVertices: () => string[]
  getValidRouteEdges: () => string[]
  getCurrentPlayer: () => Player | null
}

function nextPlayerIndex(state: GameState): number {
  return (state.currentPlayerIndex + 1) % state.playerOrder.length
}

function updateLongestRoad(state: GameState): void {
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

function updateLargestArmy(state: GameState): void {
  for (const playerId of state.playerOrder) {
    const soldiers = state.players[playerId].soldiersPlayed
    if (soldiers >= 3 && soldiers > state.largestArmySize) {
      state.largestArmySize = soldiers
      state.largestArmyPlayerId = playerId
    }
  }
}

function checkWinner(state: GameState): void {
  for (const playerId of state.playerOrder) {
    const vp = calculateVP(state, playerId)
    if (vp >= 10) {
      state.winner = playerId
      state.phase = 'game_over'
    }
  }
}

function grantPortAccess(state: GameState, edgeId: string, playerId: string): void {
  state.edges[edgeId].vertexIds.forEach(vId => {
    const v = state.vertices[vId]
    if (v.portType && !state.players[playerId].ports.includes(v.portType)) {
      state.players[playerId].ports.push(v.portType)
    }
  })
}

function stealRandomResource(state: GameState, thiefId: string, victimId: string): void {
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

function findStealTargets(state: GameState, tileId: string, currentPlayerId: string): Set<string> {
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

function advanceSetup(state: GameState, ui: { setupOutpostVertexId: string | null }): void {
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

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    lobbyPlayers: [
      { name: 'Commander', isAI: false, color: 'red' },
      { name: 'General AI', isAI: true, color: 'blue' },
      { name: 'Colonel AI', isAI: true, color: 'green' },
    ],
    setupOutpostVertexId: null,
    hoveredVertexId: null,
    hoveredEdgeId: null,
    showBuildMenu: false,
    showTradeMenu: false,
    showDevCardMenu: false,
    showDiscardMenu: false,
    discardTarget: null,
    discardSelections: { ...EMPTY_RESOURCES },
    yearOfPlentySelections: [],
    game: null,

    setLobbyPlayers: (players) => set(s => { s.lobbyPlayers = players }),

    startGame: () => set(s => {
      const tiles = generateTiles()
      const { vertices: rawVertices, edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
      const vertices = assignPorts(rawVertices, edges, tiles)

      const desertTile = Object.values(tiles).find(t => t.terrain === 'desert')
      const robberTileId = desertTile?.id ?? Object.keys(tiles)[0]

      const playerConfigs = s.lobbyPlayers.map(p => ({
        name: p.name,
        color: p.color,
        isAI: p.isAI,
      }))
      const players = createInitialPlayers(playerConfigs)
      const playerOrder = Object.keys(players)

      s.game = {
        id: `game-${Date.now()}`,
        phase: 'setup',
        setupSubPhase: 'place_outpost',
        playerOrder,
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
        robberTileId,
      }
    }),

    hoverVertex: (id) => set(s => { s.hoveredVertexId = id }),
    hoverEdge: (id) => set(s => { s.hoveredEdgeId = id }),

    clickVertex: (id) => set(s => {
      if (!s.game) return
      const game = s.game
      const playerId = game.playerOrder[game.currentPlayerIndex]

      if (game.phase === 'setup' && game.setupSubPhase === 'place_outpost') {
        if (!canPlaceOutpost(id, playerId, game, true)) return
        game.vertices[id].building = { type: 'outpost', playerId }
        s.setupOutpostVertexId = id
        game.setupSubPhase = 'place_route'

        if (game.setupRound === 2) {
          const vertex = game.vertices[id]
          for (const hexId of vertex.hexIds) {
            const tile = game.tiles[hexId]
            const resource = TERRAIN_RESOURCE[tile.terrain]
            if (resource) {
              game.players[playerId].resources[resource] += 1
            }
          }
        }

        game.log.push(addLog(game, `${game.players[playerId].name} placed an outpost`, playerId))
        return
      }

      if (game.phase !== 'playing') return
      if (!game.hasRolled) return

      const vertex = game.vertices[id]
      if (!vertex) return

      if (vertex.building?.playerId === playerId && vertex.building.type === 'outpost') {
        get().buildBase(id)
        return
      }

      if (!vertex.building && canPlaceOutpost(id, playerId, game, false) && canAfford(game.players[playerId], COSTS.outpost)) {
        get().buildOutpost(id)
      }
    }),

    clickEdge: (id) => set(s => {
      if (!s.game) return
      const game = s.game
      const playerId = game.playerOrder[game.currentPlayerIndex]

      if (game.phase === 'setup' && game.setupSubPhase === 'place_route') {
        const setupVertex = s.setupOutpostVertexId ?? undefined
        if (!canPlaceRoad(id, playerId, game, true, setupVertex)) return
        game.edges[id].road = { playerId }

        grantPortAccess(game, id, playerId)
        game.log.push(addLog(game, `${game.players[playerId].name} placed a supply route`, playerId))
        advanceSetup(game, s)
        return
      }

      if (game.phase === 'playing' || game.phase === 'road_building') {
        get().buildRoute(id)
      }
    }),

    clickTile: (id) => set(s => {
      if (!s.game) return
      const game = s.game
      if (game.phase !== 'robber') return

      const currentPlayerId = game.playerOrder[game.currentPlayerIndex]
      if (id === game.robberTileId) return

      game.tiles[game.robberTileId].hasRobber = false
      game.tiles[id].hasRobber = true
      game.robberTileId = id
      game.log.push(addLog(game, `${game.players[currentPlayerId].name} moved the robber`, currentPlayerId))

      const adjPlayers = findStealTargets(game, id, currentPlayerId)

      if (adjPlayers.size === 0) {
        game.phase = 'playing'
      } else if (adjPlayers.size === 1) {
        stealRandomResource(game, currentPlayerId, [...adjPlayers][0])
        game.phase = 'playing'
      } else {
        game.phase = 'stealing'
      }
    }),

    rollDice: () => set(s => {
      if (!s.game) return
      const game = s.game
      if (game.phase !== 'playing') return
      if (game.hasRolled) return

      const die1 = Math.floor(Math.random() * 6) + 1
      const die2 = Math.floor(Math.random() * 6) + 1
      const total = die1 + die2
      game.lastRoll = { die1, die2, total }
      game.hasRolled = true

      const currentPlayer = game.players[game.playerOrder[game.currentPlayerIndex]]

      if (total === 7) {
        const mustDiscardPlayers = game.playerOrder.filter(pid =>
          mustDiscard(game.players[pid])
        )

        if (mustDiscardPlayers.length > 0) {
          game.phase = 'discard'
          s.discardTarget = mustDiscardPlayers[0]
          s.discardSelections = { ...EMPTY_RESOURCES }
          s.showDiscardMenu = true
        } else {
          game.phase = 'robber'
        }

        game.log.push(addLog(game, `${currentPlayer.name} rolled 7! Robber activates.`))
        return
      }

      const production = produceResources(game, total)
      for (const [pid, res] of Object.entries(production)) {
        game.players[pid].resources = addResources(game.players[pid].resources, res)
      }
      game.log.push(addLog(game, `${currentPlayer.name} rolled ${total} (${die1}+${die2})`))
    }),

    endTurn: () => set(s => {
      if (!s.game) return
      const game = s.game
      if (game.phase !== 'playing') return
      if (!game.hasRolled) return

      const currentPlayerId = game.playerOrder[game.currentPlayerIndex]
      game.players[currentPlayerId].devCardsPlayedThisTurn = 0
      game.devCardPlayedThisTurn = false

      game.currentPlayerIndex = nextPlayerIndex(game)
      game.hasRolled = false
      game.lastRoll = null
      game.turn += 1

      s.showBuildMenu = false
    }),

    buildRoute: (edgeId) => set(s => {
      if (!s.game) return
      const game = s.game
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

      if (game.phase === 'road_building') {
        if (!canPlaceRoad(edgeId, playerId, game, false)) return
        game.edges[edgeId].road = { playerId }
        game.freeRoadsRemaining -= 1
        if (game.freeRoadsRemaining === 0) game.phase = 'playing'
      } else {
        if (!game.hasRolled) return
        if (!canAfford(player, COSTS.route)) return
        if (!canPlaceRoad(edgeId, playerId, game, false)) return
        game.players[playerId].resources = subtractResources(player.resources, COSTS.route)
        game.edges[edgeId].road = { playerId }
      }

      grantPortAccess(game, edgeId, playerId)
      updateLongestRoad(game)
      game.log.push(addLog(game, `${player.name} built a supply route`, playerId))
      checkWinner(game)
    }),

    buildOutpost: (vertexId) => set(s => {
      if (!s.game) return
      const game = s.game
      if (!game.hasRolled) return
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

      if (!canPlaceOutpost(vertexId, playerId, game, false)) return
      if (!canAfford(player, COSTS.outpost)) return

      game.players[playerId].resources = subtractResources(player.resources, COSTS.outpost)
      game.vertices[vertexId].building = { type: 'outpost', playerId }

      const v = game.vertices[vertexId]
      if (v.portType && !game.players[playerId].ports.includes(v.portType)) {
        game.players[playerId].ports.push(v.portType)
      }

      game.log.push(addLog(game, `${player.name} built an outpost`, playerId))
      checkWinner(game)
    }),

    buildBase: (vertexId) => set(s => {
      if (!s.game) return
      const game = s.game
      if (!game.hasRolled) return
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

      if (!canPlaceBase(vertexId, playerId, game)) return
      if (!canAfford(player, COSTS.base)) return

      game.players[playerId].resources = subtractResources(player.resources, COSTS.base)
      game.vertices[vertexId].building = { type: 'base', playerId }

      game.log.push(addLog(game, `${player.name} upgraded to a base`, playerId))
      checkWinner(game)
    }),

    buyDevCard: () => set(s => {
      if (!s.game) return
      const game = s.game
      if (!game.hasRolled) return
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

      if (!canAfford(player, COSTS.devCard)) return
      if (game.devCardDeck.length === 0) return

      game.players[playerId].resources = subtractResources(player.resources, COSTS.devCard)
      const card = game.devCardDeck.shift()!
      game.players[playerId].devCards.push(card)

      if (card === 'victory_point') {
        game.players[playerId].hiddenVP += 1
      }

      game.log.push(addLog(game, `${player.name} bought a development card`, playerId))
      checkWinner(game)
    }),

    playDevCard: (type) => set(s => {
      if (!s.game) return
      const game = s.game
      if (game.devCardPlayedThisTurn) return
      if (game.phase !== 'playing') return

      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

      if (type !== 'soldier' && !game.hasRolled) return

      const cardIdx = player.devCards.indexOf(type)
      if (cardIdx === -1) return

      game.players[playerId].devCards.splice(cardIdx, 1)
      game.devCardPlayedThisTurn = true

      switch (type) {
        case 'soldier':
          game.players[playerId].soldiersPlayed += 1
          updateLargestArmy(game)
          game.phase = 'robber'
          game.log.push(addLog(game, `${player.name} played a Soldier card`, playerId))
          break
        case 'road_building':
          game.phase = 'road_building'
          game.freeRoadsRemaining = 2
          game.log.push(addLog(game, `${player.name} played Road Building`, playerId))
          break
        case 'year_of_plenty':
          s.yearOfPlentySelections = []
          game.log.push(addLog(game, `${player.name} played Year of Plenty`, playerId))
          break
        case 'monopoly':
          game.log.push(addLog(game, `${player.name} played Monopoly`, playerId))
          break
        case 'victory_point':
          break
      }

      checkWinner(game)
    }),

    chooseMonopolyResource: (resource) => set(s => {
      if (!s.game) return
      const game = s.game
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

      let total = 0
      for (const pid of game.playerOrder) {
        if (pid === playerId) continue
        const amount = game.players[pid].resources[resource]
        total += amount
        game.players[pid].resources[resource] = 0
      }
      game.players[playerId].resources[resource] += total

      game.log.push(addLog(game, `${player.name} monopolized ${resource} (gained ${total})`, playerId))
    }),

    chooseYearOfPlentyResource: (resource) => set(s => {
      if (!s.game) return
      s.yearOfPlentySelections.push(resource)
    }),

    confirmYearOfPlenty: () => set(s => {
      if (!s.game) return
      const game = s.game
      const playerId = game.playerOrder[game.currentPlayerIndex]

      for (const resource of s.yearOfPlentySelections) {
        game.players[playerId].resources[resource] += 1
      }
      s.yearOfPlentySelections = []
    }),

    bankTrade: (giving, receiving) => set(s => {
      if (!s.game) return
      const game = s.game
      if (!game.hasRolled) return
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

      const ratio = getTradeRatio(player, giving)
      if (player.resources[giving] < ratio) return

      game.players[playerId].resources[giving] -= ratio
      game.players[playerId].resources[receiving] += 1

      game.log.push(addLog(game, `${player.name} traded ${ratio} ${giving} for 1 ${receiving}`, playerId))
    }),

    moveRobber: (tileId) => {
      get().clickTile(tileId)
    },

    stealResource: (fromPlayerId) => set(s => {
      if (!s.game) return
      const game = s.game
      const currentPlayerId = game.playerOrder[game.currentPlayerIndex]

      stealRandomResource(game, currentPlayerId, fromPlayerId)
      game.phase = 'playing'
    }),

    updateDiscardSelection: (resource, delta) => set(s => {
      if (!s.discardTarget || !s.game) return
      const player = s.game.players[s.discardTarget]
      const current = s.discardSelections[resource]
      const newVal = Math.max(0, Math.min(current + delta, player.resources[resource]))
      s.discardSelections[resource] = newVal
    }),

    confirmDiscard: () => set(s => {
      if (!s.game || !s.discardTarget) return
      const game = s.game
      const pid = s.discardTarget
      const needed = discardAmount(game.players[pid])
      const total = totalResources(s.discardSelections)
      if (total !== needed) return

      for (const [res, amt] of Object.entries(s.discardSelections) as [ResourceType, number][]) {
        game.players[pid].resources[res] -= amt
      }
      game.log.push(addLog(game, `${game.players[pid].name} discarded ${needed} resources`, pid))

      const remaining = game.playerOrder.filter(
        pid2 => pid2 !== pid && mustDiscard(game.players[pid2])
      )
      if (remaining.length > 0) {
        s.discardTarget = remaining[0]
        s.discardSelections = { ...EMPTY_RESOURCES }
      } else {
        s.discardTarget = null
        s.showDiscardMenu = false
        game.phase = 'robber'
      }
    }),

    toggleBuildMenu: (open) => set(s => {
      s.showBuildMenu = open !== undefined ? open : !s.showBuildMenu
      if (s.showBuildMenu) { s.showTradeMenu = false; s.showDevCardMenu = false }
    }),
    toggleTradeMenu: (open) => set(s => {
      s.showTradeMenu = open !== undefined ? open : !s.showTradeMenu
      if (s.showTradeMenu) { s.showBuildMenu = false; s.showDevCardMenu = false }
    }),
    toggleDevCardMenu: (open) => set(s => {
      s.showDevCardMenu = open !== undefined ? open : !s.showDevCardMenu
      if (s.showDevCardMenu) { s.showBuildMenu = false; s.showTradeMenu = false }
    }),

    getValidOutpostVertices: () => {
      const { game } = get()
      if (!game) return []
      const playerId = game.playerOrder[game.currentPlayerIndex]
      return Object.keys(game.vertices).filter(id =>
        canPlaceOutpost(id, playerId, game, game.phase === 'setup')
      )
    },

    getValidBaseVertices: () => {
      const { game } = get()
      if (!game) return []
      const playerId = game.playerOrder[game.currentPlayerIndex]
      return Object.keys(game.vertices).filter(id =>
        canPlaceBase(id, playerId, game)
      )
    },

    getValidRouteEdges: () => {
      const { game, setupOutpostVertexId } = get()
      if (!game) return []
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const isSetup = game.phase === 'setup'
      return Object.keys(game.edges).filter(id =>
        canPlaceRoad(id, playerId, game, isSetup, setupOutpostVertexId ?? undefined)
      )
    },

    getCurrentPlayer: () => {
      const { game } = get()
      if (!game) return null
      return game.players[game.playerOrder[game.currentPlayerIndex]]
    },
  }))
)
