import type { CubeCoord, TerrainType } from '../types/game'

export interface MapConfig {
  id: string
  name: string
  description: string
  coords: CubeCoord[]
  terrains: TerrainType[]
  numberTokens: number[]
}

function hexRing(radius: number): CubeCoord[] {
  const coords: CubeCoord[] = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r
      if (Math.abs(s) <= radius) {
        coords.push({ q, r, s })
      }
    }
  }
  return coords
}

const STANDARD_TERRAINS: TerrainType[] = [
  'food', 'food', 'food', 'food',
  'supplies', 'supplies', 'supplies', 'supplies',
  'tools', 'tools', 'tools', 'tools',
  'weapons', 'weapons', 'weapons',
  'ammo', 'ammo', 'ammo',
  'desert',
]

const STANDARD_TOKENS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11]

const LARGE_TERRAINS: TerrainType[] = [
  'food', 'food', 'food', 'food', 'food', 'food',
  'supplies', 'supplies', 'supplies', 'supplies', 'supplies', 'supplies',
  'tools', 'tools', 'tools', 'tools', 'tools', 'tools',
  'weapons', 'weapons', 'weapons', 'weapons', 'weapons',
  'ammo', 'ammo', 'ammo', 'ammo', 'ammo',
  'desert', 'desert',
]

const LARGE_TOKENS = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
  2, 3, 4, 5, 6, 8, 9, 10, 11,
]

const SMALL_TERRAINS: TerrainType[] = [
  'food', 'food',
  'supplies', 'supplies',
  'tools', 'tools',
  'weapons',
  'ammo',
  'desert',
]

const SMALL_TOKENS = [3, 4, 5, 6, 8, 9, 10, 11]

function diamondCoords(): CubeCoord[] {
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

function snakeCoords(): CubeCoord[] {
  const coords: CubeCoord[] = []
  const layout = [2, 4, 5, 5, 3]
  const rowOffsets = [-2, -1, 0, 1, 2]
  const qStarts = [0, -1, -2, -2, -1]

  for (let row = 0; row < 5; row++) {
    const count = layout[row]
    const r = rowOffsets[row]
    for (let i = 0; i < count; i++) {
      const q = qStarts[row] + i
      const s = -q - r
      coords.push({ q, r, s })
    }
  }

  return coords
}

export const MAP_CONFIGS: MapConfig[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: '19 hexes, classic hexagonal board',
    coords: hexRing(2),
    terrains: STANDARD_TERRAINS,
    numberTokens: STANDARD_TOKENS,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    description: '19 hexes, offset diamond shape',
    coords: diamondCoords(),
    terrains: STANDARD_TERRAINS,
    numberTokens: STANDARD_TOKENS,
  },
  {
    id: 'large',
    name: 'Large',
    description: '37 hexes, bigger board for longer games',
    coords: hexRing(3),
    terrains: LARGE_TERRAINS,
    numberTokens: LARGE_TOKENS,
  },
  {
    id: 'small',
    name: 'Small',
    description: '9 hexes, quick game',
    coords: hexRing(1).concat([
      { q: 2, r: -1, s: -1 },
      { q: -2, r: 1, s: 1 },
      { q: 1, r: 1, s: -2 },
    ]),
    terrains: SMALL_TERRAINS,
    numberTokens: SMALL_TOKENS,
  },
  {
    id: 'snake',
    name: 'Snake',
    description: '19 hexes, asymmetric layout',
    coords: snakeCoords(),
    terrains: STANDARD_TERRAINS,
    numberTokens: STANDARD_TOKENS,
  },
]

export function getMapConfig(id: string): MapConfig {
  return MAP_CONFIGS.find(m => m.id === id) ?? MAP_CONFIGS[0]
}
