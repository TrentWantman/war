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

export interface Vertex {
  id: string
  hexIds: string[]
  building: Building | null
  portType: PortType | null
  position: Point
}

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
  soldiersPlayed: number
  publicVP: number
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

export type GamePhase =
  | 'lobby'
  | 'setup'
  | 'playing'
  | 'robber'
  | 'discard'
  | 'stealing'
  | 'road_building'
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
  longestRoadPlayerId: string | null
  longestRoadLength: number
  largestArmyPlayerId: string | null
  largestArmySize: number
  turn: number
  winner: string | null
  log: GameLog[]
  freeRoadsRemaining: number
  robberTileId: string
}
