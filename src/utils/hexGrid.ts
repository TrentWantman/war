import type { CubeCoord, Point, HexTile, Vertex, Edge, TerrainType } from '../types/game'

export const HEX_SIZE = 56

export function cubeToPixel(coord: CubeCoord, size: number, center: Point): Point {
  const x = center.x + size * (3 / 2) * coord.q
  const y = center.y + size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r)
  return { x, y }
}

export function hexVertices(center: Point, size: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i // 0°, 60°, 120°, 180°, 240°, 300°
    return {
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    }
  })
}

/** Standard Catan board layout: 5 rows of hexes (3-4-5-4-3) */
export function standardBoardCoords(): CubeCoord[] {
  const coords: CubeCoord[] = []
  const layout = [3, 4, 5, 4, 3]
  const rowOffsets = [-2, -1, 0, 1, 2]

  for (let row = 0; row < 5; row++) {
    const count = layout[row]
    const r = rowOffsets[row]
    const qStart = -Math.floor(count / 2)
    for (let i = 0; i < count; i++) {
      const q = qStart + i
      const s = -q - r
      coords.push({ q, r, s })
    }
  }

  return coords
}

/** Terrain distribution: 4 food, 4 supplies, 4 tools, 3 weapons, 3 ammo, 1 desert */
const TERRAIN_DISTRIBUTION: TerrainType[] = [
  'food', 'food', 'food', 'food',
  'supplies', 'supplies', 'supplies', 'supplies',
  'tools', 'tools', 'tools', 'tools',
  'weapons', 'weapons', 'weapons',
  'ammo', 'ammo', 'ammo',
  'desert',
]

/** Standard Catan number tokens (placed in spiral from outside-in) */
const NUMBER_TOKENS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11]

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateTiles(): Record<string, HexTile> {
  const coords = standardBoardCoords()
  const terrains = shuffle(TERRAIN_DISTRIBUTION)
  const tiles: Record<string, HexTile> = {}

  let tokenIdx = 0
  const numbers: (number | null)[] = []
  for (const terrain of terrains) {
    if (terrain === 'desert') {
      numbers.push(null)
    } else {
      numbers.push(NUMBER_TOKENS[tokenIdx++] ?? null)
    }
  }

  coords.forEach((coord, i) => {
    const id = coordToId(coord)
    const isDesert = terrains[i] === 'desert'
    tiles[id] = {
      id,
      coord,
      terrain: terrains[i],
      number: numbers[i],
      hasRobber: isDesert,
    }
  })

  return tiles
}

export function coordToId(coord: CubeCoord): string {
  return `${coord.q},${coord.r},${coord.s}`
}

export function tileCenter(tile: HexTile, size: number, boardCenter: Point): Point {
  return cubeToPixel(tile.coord, size, boardCenter)
}

/**
 * Generate unique vertex IDs by rounding and deduplicating pixel positions.
 * Each hex has 6 corners; adjacent hexes share corners.
 */
export function generateVerticesAndEdges(
  tiles: Record<string, HexTile>,
  size: number,
  boardCenter: Point
): { vertices: Record<string, Vertex>; edges: Record<string, Edge> } {
  const vertices: Record<string, Vertex> = {}
  const edges: Record<string, Edge> = {}

  const posToVertexId: Record<string, string> = {}
  const round = (n: number) => Math.round(n * 10) / 10

  const getOrCreateVertex = (pos: Point, hexId: string): string => {
    const key = `${round(pos.x)},${round(pos.y)}`
    if (!posToVertexId[key]) {
      const id = `v${Object.keys(posToVertexId).length}`
      posToVertexId[key] = id
      vertices[id] = {
        id,
        hexIds: [hexId],
        building: null,
        portType: null,
        position: { x: round(pos.x), y: round(pos.y) },
      }
    } else {
      const id = posToVertexId[key]
      if (!vertices[id].hexIds.includes(hexId)) {
        vertices[id].hexIds.push(hexId)
      }
    }
    return posToVertexId[key]
  }

  const tileVertexIds: Record<string, string[]> = {}

  for (const tile of Object.values(tiles)) {
    const center = tileCenter(tile, size, boardCenter)
    const corners = hexVertices(center, size)
    const vIds = corners.map(pos => getOrCreateVertex(pos, tile.id))
    tileVertexIds[tile.id] = vIds
  }

  const edgeKeySet = new Set<string>()

  for (const tile of Object.values(tiles)) {
    const vIds = tileVertexIds[tile.id]
    for (let i = 0; i < 6; i++) {
      const a = vIds[i]
      const b = vIds[(i + 1) % 6]
      const key = [a, b].sort().join('-')
      if (!edgeKeySet.has(key)) {
        edgeKeySet.add(key)
        const id = `e${edges ? Object.keys(edges).length : 0}`
        const pa = vertices[a].position
        const pb = vertices[b].position
        edges[id] = {
          id,
          vertexIds: [a, b],
          road: null,
          position: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
          angle: Math.atan2(pb.y - pa.y, pb.x - pa.x),
        }
      }
    }
  }

  return { vertices, edges }
}

export function getVertexEdges(vertexId: string, edges: Record<string, Edge>): Edge[] {
  return Object.values(edges).filter(e => e.vertexIds.includes(vertexId))
}

export function otherVertex(edge: Edge, vertexId: string): string {
  return edge.vertexIds[0] === vertexId ? edge.vertexIds[1] : edge.vertexIds[0]
}

export function getAdjacentVertices(
  vertexId: string,
  edges: Record<string, Edge>
): string[] {
  return getVertexEdges(vertexId, edges).map(e => otherVertex(e, vertexId))
}

export function getHexVertices(hexId: string, vertices: Record<string, Vertex>): Vertex[] {
  return Object.values(vertices).filter(v => v.hexIds.includes(hexId))
}

export const TERRAIN_CONFIG: Record<string, { label: string; color: string; darkColor: string; resource?: string }> = {
  food:     { label: 'Fields',    color: '#f59e0b', darkColor: '#d97706', resource: 'food' },
  weapons:  { label: 'Quarries',  color: '#ef4444', darkColor: '#dc2626', resource: 'weapons' },
  ammo:     { label: 'Mountains', color: '#6b7280', darkColor: '#4b5563', resource: 'ammo' },
  tools:    { label: 'Forests',   color: '#92400e', darkColor: '#78350f', resource: 'tools' },
  supplies: { label: 'Pastures',  color: '#86efac', darkColor: '#4ade80', resource: 'supplies' },
  desert:   { label: 'Desert',    color: '#d2b48c', darkColor: '#c4a882' },
}

export const RESOURCE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  food:     { label: 'Food',     color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)',  icon: '🌾' },
  weapons:  { label: 'Weapons',  color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)',   icon: '⚔️' },
  ammo:     { label: 'Ammo',     color: '#9ca3af', bgColor: 'rgba(156,163,175,0.15)', icon: '💣' },
  tools:    { label: 'Tools',    color: '#b45309', bgColor: 'rgba(180,83,9,0.15)',    icon: '🔧' },
  supplies: { label: 'Supplies', color: '#86efac', bgColor: 'rgba(134,239,172,0.15)', icon: '📦' },
}
