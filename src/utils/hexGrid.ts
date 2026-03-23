import type { CubeCoord, Point, HexTile, Vertex, Edge } from '../types/game'
import type { MapConfig } from './maps'
import { getMapConfig } from './maps'

export const HEX_SIZE = 56

export function hexSizeForMap(mapId: string): number {
  const config = getMapConfig(mapId)
  const count = config.coords.length
  if (count <= 9) return 70
  if (count <= 19) return 56
  return 38
}

export function cubeToPixel(coord: CubeCoord, size: number, center: Point): Point {
  const x = center.x + size * (3 / 2) * coord.q
  const y = center.y + size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r)
  return { x, y }
}

export function hexCorners(center: Point, size: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i
    return {
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    }
  })
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function coordToId(coord: CubeCoord): string {
  return `${coord.q},${coord.r},${coord.s}`
}

export function tileCenter(tile: HexTile, size: number, boardCenter: Point): Point {
  return cubeToPixel(tile.coord, size, boardCenter)
}

export function generateTiles(mapId: string = 'standard'): Record<string, HexTile> {
  const config = getMapConfig(mapId)
  return generateTilesFromConfig(config)
}

export function generateTilesFromConfig(config: MapConfig): Record<string, HexTile> {
  const terrains = shuffle(config.terrains)
  const tiles: Record<string, HexTile> = {}

  let tokenIdx = 0
  const numbers: (number | null)[] = []
  for (const terrain of terrains) {
    if (terrain === 'desert') {
      numbers.push(null)
    } else {
      numbers.push(config.numberTokens[tokenIdx++] ?? null)
    }
  }

  config.coords.forEach((coord, i) => {
    const id = coordToId(coord)
    tiles[id] = {
      id,
      coord,
      terrain: terrains[i],
      number: numbers[i],
      hasRobber: terrains[i] === 'desert',
    }
  })

  return tiles
}

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
    const corners = hexCorners(center, size)
    tileVertexIds[tile.id] = corners.map(pos => getOrCreateVertex(pos, tile.id))
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
        const id = `e${Object.keys(edges).length}`
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
