export type ResourceType = 'food' | 'weapons' | 'ammo' | 'tools' | 'supplies'
export type TerrainType = ResourceType | 'desert'

export interface Resources {
  food: number
  weapons: number
  ammo: number
  tools: number
  supplies: number
}

export const EMPTY_RESOURCES: Resources = {
  food: 0,
  weapons: 0,
  ammo: 0,
  tools: 0,
  supplies: 0,
}

export interface CubeCoord {
  q: number
  r: number
  s: number
}

export interface Point {
  x: number
  y: number
}

export interface HexTile {
  id: string
  coord: CubeCoord
  terrain: TerrainType
  /** Number token (2-12), null for desert */
  number: number | null
  hasRobber: boolean
}

export type PortType = ResourceType | 'generic'

export interface Port {
  id: string
  type: PortType
  vertices: [number, number]
  hexId: string
  edgeIndex: number
}

/** Vertex = intersection of 3 hexes = potential settlement/city location */
export interface Vertex {
  id: string
  /** Up to 3 adjacent hex IDs */
  hexIds: string[]
  building: Building | null
  portType: PortType | null
  position: Point
}

/** Edge = connection between 2 vertices = potential road location */
export interface Edge {
  id: string
  vertexIds: [string, string]
  road: Road | null
  position: Point
  angle: number
}

export type BuildingType = 'outpost' | 'base'

export interface Building {
  type: BuildingType
  playerId: string
}

export interface Road {
  playerId: string
}

export type PlayerColor = 'red' | 'blue' | 'green' | 'orange'

export interface Player {
  id: string
  name: string
  color: PlayerColor
  resources: Resources
  devCards: DevCardType[]
  devCardsPlayedThisTurn: number
  /** Total soldiers played (for Largest Force) */
  soldiersPlayed: number
  /** Victory points visible to all players (excludes hidden VP cards) */
  publicVP: number
  /** Hidden VP from victory point dev cards */
  hiddenVP: number
  ports: PortType[]
  isAI: boolean
  isConnected: boolean
}

export type DevCardType =
  | 'soldier'
  | 'road_building'
  | 'year_of_plenty'
  | 'monopoly'
  | 'victory_point'

export interface DevCard {
  type: DevCardType
  /** Which turn it was drawn (can't play same turn drawn) */
  drawnOnTurn: number
}

export type GamePhase =
  | 'lobby'
  | 'setup'         // Initial placement
  | 'playing'       // Main game
  | 'robber'        // Moving robber after 7
  | 'discard'       // Discarding resources after 7 with 8+ cards
  | 'stealing'      // Choosing who to steal from
  | 'road_building' // Free road placement (dev card)
  | 'game_over'

export type SetupSubPhase = 'place_outpost' | 'place_route'

export interface DiceRoll {
  die1: number
  die2: number
  total: number
}

export interface TradeOffer {
  id: string
  fromPlayerId: string
  toPlayerId: string | null
  offering: Resources
  requesting: Resources
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
}

export interface GameLog {
  id: string
  turn: number
  timestamp: number
  message: string
  playerId?: string
}

export interface GameState {
  id: string
  phase: GamePhase
  setupSubPhase: SetupSubPhase
  playerOrder: string[]
  players: Record<string, Player>
  currentPlayerIndex: number
  /** 1 or 2; second round is reverse order */
  setupRound: 1 | 2
  tiles: Record<string, HexTile>
  vertices: Record<string, Vertex>
  edges: Record<string, Edge>
  ports: Port[]
  devCardDeck: DevCardType[]
  lastRoll: DiceRoll | null
  hasRolled: boolean
  devCardPlayedThisTurn: boolean
  activeTrade: TradeOffer | null
  /** Player with Longest Supply Line (5+ roads) */
  longestRoadPlayerId: string | null
  longestRoadLength: number
  /** Player with Largest Force (3+ soldiers) */
  largestArmyPlayerId: string | null
  largestArmySize: number
  turn: number
  winner: string | null
  log: GameLog[]
  /** How many free roads remain from a road_building dev card */
  freeRoadsRemaining: number
  yearOfPlentyRemaining: number
  monopolyResource: ResourceType | null
  robberTileId: string
}
