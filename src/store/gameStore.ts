import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  GameState, Player, Resources, ResourceType, DevCardType,
  PlayerColor,
} from '../types/game'
import { EMPTY_RESOURCES } from '../types/game'
import {
  generateTiles, generateVerticesAndEdges, HEX_SIZE,
} from '../utils/hexGrid'
import {
  COSTS, canAfford, subtractResources, addResources,
  produceResources, calculateLongestRoad, calculateVP,
  createDevCardDeck, createInitialPlayers, addLog, mustDiscard, discardAmount,
  canPlaceOutpost, canPlaceBase, canPlaceRoad, getTradeRatio, assignPorts,
  totalResources, TERRAIN_RESOURCE,
} from '../utils/gameLogic'

const BOARD_CENTER = { x: 350, y: 310 }

interface LobbyPlayer {
  name: string
  isAI: boolean
  color: PlayerColor
}

interface GameStore {
  // UI state
  lobbyPlayers: LobbyPlayer[]
  selectedVertexId: string | null
  selectedEdgeId: string | null
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

  // Game state
  game: GameState | null

  // Actions - Lobby
  setLobbyPlayers: (players: LobbyPlayer[]) => void
  startGame: () => void

  // Actions - Board interaction
  hoverVertex: (id: string | null) => void
  hoverEdge: (id: string | null) => void
  clickVertex: (id: string) => void
  clickEdge: (id: string) => void
  clickTile: (id: string) => void

  // Actions - Turn
  rollDice: () => void
  endTurn: () => void

  // Actions - Building
  buildRoute: (edgeId: string) => void
  buildOutpost: (vertexId: string) => void
  buildBase: (vertexId: string) => void
  buyDevCard: () => void

  // Actions - Dev Cards
  playDevCard: (type: DevCardType) => void
  chooseMonopolyResource: (resource: ResourceType) => void
  chooseYearOfPlentyResource: (resource: ResourceType) => void
  confirmYearOfPlenty: () => void

  // Actions - Trading
  bankTrade: (giving: ResourceType, receiving: ResourceType) => void
  proposeTrade: (offering: Resources, requesting: Resources, toPlayerId?: string) => void
  respondTrade: (tradeId: string, accept: boolean) => void
  cancelTrade: () => void

  // Actions - Robber
  moveRobber: (tileId: string) => void
  stealResource: (fromPlayerId: string) => void

  // Actions - Discard
  updateDiscardSelection: (resource: ResourceType, delta: number) => void
  confirmDiscard: () => void

  // UI toggles
  toggleBuildMenu: (open?: boolean) => void
  toggleTradeMenu: (open?: boolean) => void
  toggleDevCardMenu: (open?: boolean) => void

  // Computed helpers
  getValidOutpostVertices: () => string[]
  getValidBaseVertices: () => string[]
  getValidRouteEdges: () => string[]
  getCurrentPlayer: () => Player | null
}

function nextPlayerIndex(state: GameState): number {
  return (state.currentPlayerIndex + 1) % state.playerOrder.length
}

function updateLongestRoad(state: GameState): void {
  for (const playerId of state.playerOrder) {
    const len = calculateLongestRoad(playerId, state.vertices, state.edges)
    if (len >= 5 && len > state.longestRoadLength) {
      state.longestRoadLength = len
      state.longestRoadPlayerId = playerId
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

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    lobbyPlayers: [
      { name: 'Commander', isAI: false, color: 'red' },
      { name: 'General AI', isAI: true, color: 'blue' },
      { name: 'Colonel AI', isAI: true, color: 'green' },
    ],
    selectedVertexId: null,
    selectedEdgeId: null,
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
        yearOfPlentyRemaining: 0,
        monopolyResource: null,
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

        // Round 2: give starting resources from adjacent tiles
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

      if (game.phase === 'setup') return
      if (game.phase === 'robber' || game.phase === 'stealing') return

      s.selectedVertexId = id
    }),

    clickEdge: (id) => set(s => {
      if (!s.game) return
      const game = s.game
      const playerId = game.playerOrder[game.currentPlayerIndex]

      if (game.phase === 'setup' && game.setupSubPhase === 'place_route') {
        const setupVertex = s.setupOutpostVertexId ?? undefined
        if (!canPlaceRoad(id, playerId, game, true, setupVertex)) return
        game.edges[id].road = { playerId }

        game.edges[id].vertexIds.forEach(vId => {
          const v = game.vertices[vId]
          if (v.portType && !game.players[playerId].ports.includes(v.portType)) {
            game.players[playerId].ports.push(v.portType)
          }
        })

        game.log.push(addLog(game, `${game.players[playerId].name} placed a supply route`, playerId))

        const playerCount = game.playerOrder.length
        const idx = game.currentPlayerIndex

        if (game.setupRound === 1) {
          if (idx < playerCount - 1) {
            game.currentPlayerIndex = idx + 1
            game.setupSubPhase = 'place_outpost'
          } else {
            // Start round 2 in reverse order; currentPlayerIndex stays at last player
            game.setupRound = 2
            game.setupSubPhase = 'place_outpost'
          }
        } else {
          if (idx > 0) {
            game.currentPlayerIndex = idx - 1
            game.setupSubPhase = 'place_outpost'
          } else {
            game.phase = 'playing'
            game.setupSubPhase = 'place_outpost'
            game.currentPlayerIndex = 0
            game.log.push(addLog(game, 'Setup complete! Game begins. Roll dice to start your turn.'))
          }
        }
        s.setupOutpostVertexId = null
        return
      }

      s.selectedEdgeId = id
    }),

    clickTile: (id) => set(s => {
      if (!s.game) return
      const game = s.game
      if (game.phase === 'robber') {
        const currentPlayerId = game.playerOrder[game.currentPlayerIndex]
        if (id === game.robberTileId) return

        game.tiles[game.robberTileId].hasRobber = false
        game.tiles[id].hasRobber = true
        game.robberTileId = id
        game.log.push(addLog(game, `${game.players[currentPlayerId].name} moved the robber`, currentPlayerId))

        const adjPlayers = new Set<string>()
        const adjVertices = Object.values(game.vertices).filter(v => v.hexIds.includes(id))
        for (const v of adjVertices) {
          if (v.building && v.building.playerId !== currentPlayerId) {
            if (totalResources(game.players[v.building.playerId].resources) > 0) {
              adjPlayers.add(v.building.playerId)
            }
          }
        }

        if (adjPlayers.size === 0) {
          game.phase = 'playing'
        } else if (adjPlayers.size === 1) {
          const victimId = [...adjPlayers][0]
          const resources = Object.entries(game.players[victimId].resources)
            .filter(([, count]) => count > 0)
            .map(([res]) => res as ResourceType)
          const stolen = resources[Math.floor(Math.random() * resources.length)]
          game.players[victimId].resources[stolen] -= 1
          game.players[currentPlayerId].resources[stolen] += 1
          game.log.push(addLog(game, `${game.players[currentPlayerId].name} stole 1 resource from ${game.players[victimId].name}`, currentPlayerId))
          game.phase = 'playing'
        } else {
          game.phase = 'stealing'
        }
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

        const currentPlayer = game.players[game.playerOrder[game.currentPlayerIndex]]
        game.log.push(addLog(game, `${currentPlayer.name} rolled 7! Robber activates.`))
      } else {
        const production = produceResources(game, total)
        for (const [pid, res] of Object.entries(production)) {
          game.players[pid].resources = addResources(game.players[pid].resources, res)
        }

        const currentPlayer = game.players[game.playerOrder[game.currentPlayerIndex]]
        game.log.push(addLog(game, `${currentPlayer.name} rolled ${total} (${die1}+${die2})`))
      }
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

      s.selectedVertexId = null
      s.selectedEdgeId = null
      s.showBuildMenu = false
      // AI turns are handled by useAIPlayer
    }),

    buildRoute: (edgeId) => set(s => {
      if (!s.game) return
      const game = s.game
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

      if (game.phase === 'road_building') {
        // Free road from road_building dev card
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

      // Grant port access if road endpoint touches a port vertex
      game.edges[edgeId].vertexIds.forEach(vId => {
        const v = game.vertices[vId]
        if (v.portType && !game.players[playerId].ports.includes(v.portType)) {
          game.players[playerId].ports.push(v.portType)
        }
      })

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
      const playerId = game.playerOrder[game.currentPlayerIndex]
      const player = game.players[playerId]

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
          game.yearOfPlentyRemaining = 2
          s.yearOfPlentySelections = []
          game.log.push(addLog(game, `${player.name} played Year of Plenty`, playerId))
          break
        case 'monopoly':
          game.log.push(addLog(game, `${player.name} played Monopoly`, playerId))
          // Resource selection handled in chooseMonopolyResource
          break
        case 'victory_point':
          // VP cards are revealed automatically on win, not played
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

    proposeTrade: (offering, requesting, toPlayerId) => set(s => {
      if (!s.game) return
      const game = s.game
      const playerId = game.playerOrder[game.currentPlayerIndex]

      game.activeTrade = {
        id: `trade-${Date.now()}`,
        fromPlayerId: playerId,
        toPlayerId: toPlayerId ?? null,
        offering,
        requesting,
        status: 'pending',
      }
    }),

    respondTrade: (tradeId, accept) => set(s => {
      if (!s.game) return
      const game = s.game
      if (!game.activeTrade || game.activeTrade.id !== tradeId) return

      if (accept) {
        const { fromPlayerId, toPlayerId, offering, requesting } = game.activeTrade
        if (!toPlayerId) return
        game.players[fromPlayerId].resources = subtractResources(game.players[fromPlayerId].resources, offering)
        game.players[fromPlayerId].resources = addResources(game.players[fromPlayerId].resources, requesting)
        game.players[toPlayerId].resources = subtractResources(game.players[toPlayerId].resources, requesting)
        game.players[toPlayerId].resources = addResources(game.players[toPlayerId].resources, offering)

        game.log.push(addLog(game, `Trade accepted between ${game.players[fromPlayerId].name} and ${game.players[toPlayerId].name}`))
      }
      game.activeTrade = null
    }),

    cancelTrade: () => set(s => {
      if (!s.game) return
      s.game.activeTrade = null
    }),

    moveRobber: (tileId) => set(s => {
      if (!s.game) return
      get().clickTile(tileId) // delegated to clickTile
    }),

    stealResource: (fromPlayerId) => set(s => {
      if (!s.game) return
      const game = s.game
      const currentPlayerId = game.playerOrder[game.currentPlayerIndex]
      const victim = game.players[fromPlayerId]

      const resources = (Object.entries(victim.resources) as [ResourceType, number][])
        .filter(([, count]) => count > 0)
        .map(([res]) => res)
      if (resources.length === 0) return

      const stolen = resources[Math.floor(Math.random() * resources.length)]
      game.players[fromPlayerId].resources[stolen] -= 1
      game.players[currentPlayerId].resources[stolen] += 1

      game.log.push(addLog(game, `${game.players[currentPlayerId].name} stole 1 resource from ${victim.name}`, currentPlayerId))
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
