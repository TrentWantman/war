import { describe, it, expect } from 'vitest'
import {
  cubeToPixel, hexCorners, coordToId,
  generateTiles, generateVerticesAndEdges, shuffle,
  getVertexEdges, otherVertex, getAdjacentVertices, getHexVertices,
  HEX_SIZE,
} from './hexGrid'
import { getMapConfig } from './maps'
import { BOARD_CENTER } from '../constants/colors'

describe('cubeToPixel', () => {
  it('returns center for origin coord', () => {
    const center = { x: 100, y: 100 }
    const result = cubeToPixel({ q: 0, r: 0, s: 0 }, 10, center)
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(100)
  })

  it('offsets correctly for non-zero q', () => {
    const center = { x: 0, y: 0 }
    const result = cubeToPixel({ q: 1, r: 0, s: -1 }, 10, center)
    expect(result.x).toBeCloseTo(15)
  })
})

describe('hexCorners', () => {
  it('returns 6 corners', () => {
    const corners = hexCorners({ x: 0, y: 0 }, 10)
    expect(corners.length).toBe(6)
  })

  it('all corners are at correct distance from center', () => {
    const center = { x: 50, y: 50 }
    const size = 20
    const corners = hexCorners(center, size)
    for (const corner of corners) {
      const dist = Math.sqrt((corner.x - center.x) ** 2 + (corner.y - center.y) ** 2)
      expect(dist).toBeCloseTo(size, 5)
    }
  })
})

describe('standard map coords', () => {
  it('returns 19 coordinates', () => {
    const config = getMapConfig('standard')
    expect(config.coords.length).toBe(19)
  })

  it('all coords satisfy q + r + s = 0', () => {
    const config = getMapConfig('standard')
    for (const coord of config.coords) {
      expect(coord.q + coord.r + coord.s).toBe(0)
    }
  })

  it('large map returns 37 coordinates', () => {
    const config = getMapConfig('large')
    expect(config.coords.length).toBe(37)
  })
})

describe('coordToId', () => {
  it('produces consistent string ids', () => {
    expect(coordToId({ q: 1, r: -2, s: 1 })).toBe('1,-2,1')
  })
})

describe('shuffle', () => {
  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const shuffled = shuffle(arr)
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('does not modify original array', () => {
    const arr = [1, 2, 3]
    shuffle(arr)
    expect(arr).toEqual([1, 2, 3])
  })
})

describe('generateTiles', () => {
  it('generates 19 tiles', () => {
    const tiles = generateTiles()
    expect(Object.keys(tiles).length).toBe(19)
  })

  it('has exactly 1 desert', () => {
    const tiles = generateTiles()
    const deserts = Object.values(tiles).filter(t => t.terrain === 'desert')
    expect(deserts.length).toBe(1)
  })

  it('desert has no number', () => {
    const tiles = generateTiles()
    const desert = Object.values(tiles).find(t => t.terrain === 'desert')
    expect(desert?.number).toBeNull()
  })

  it('desert has robber', () => {
    const tiles = generateTiles()
    const desert = Object.values(tiles).find(t => t.terrain === 'desert')
    expect(desert?.hasRobber).toBe(true)
  })

  it('non-desert tiles have numbers', () => {
    const tiles = generateTiles()
    const nonDesert = Object.values(tiles).filter(t => t.terrain !== 'desert')
    for (const tile of nonDesert) {
      expect(tile.number).not.toBeNull()
      expect(tile.number).toBeGreaterThanOrEqual(2)
      expect(tile.number).toBeLessThanOrEqual(12)
    }
  })
})

describe('generateVerticesAndEdges', () => {
  it('generates expected number of unique vertices', () => {
    const tiles = generateTiles()
    const { vertices } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
    expect(Object.keys(vertices).length).toBeGreaterThanOrEqual(54)
    expect(Object.keys(vertices).length).toBeLessThanOrEqual(56)
  })

  it('generates expected number of unique edges', () => {
    const tiles = generateTiles()
    const { edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
    expect(Object.keys(edges).length).toBeGreaterThanOrEqual(72)
    expect(Object.keys(edges).length).toBeLessThanOrEqual(74)
  })

  it('all edges reference existing vertices', () => {
    const tiles = generateTiles()
    const { vertices, edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
    for (const edge of Object.values(edges)) {
      expect(vertices[edge.vertexIds[0]]).toBeDefined()
      expect(vertices[edge.vertexIds[1]]).toBeDefined()
    }
  })
})

describe('getVertexEdges', () => {
  it('returns edges connected to vertex', () => {
    const tiles = generateTiles()
    const { vertices, edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
    const vertexId = Object.keys(vertices)[0]
    const connectedEdges = getVertexEdges(vertexId, edges)
    for (const edge of connectedEdges) {
      expect(edge.vertexIds).toContain(vertexId)
    }
  })
})

describe('otherVertex', () => {
  it('returns the other vertex id', () => {
    const tiles = generateTiles()
    const { edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
    const edge = Object.values(edges)[0]
    expect(otherVertex(edge, edge.vertexIds[0])).toBe(edge.vertexIds[1])
    expect(otherVertex(edge, edge.vertexIds[1])).toBe(edge.vertexIds[0])
  })
})

describe('getAdjacentVertices', () => {
  it('returns adjacent vertex ids', () => {
    const tiles = generateTiles()
    const { vertices, edges } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
    const vertexId = Object.keys(vertices)[0]
    const adjacent = getAdjacentVertices(vertexId, edges)
    expect(adjacent.length).toBeGreaterThan(0)
    expect(adjacent.length).toBeLessThanOrEqual(3)
  })
})

describe('getHexVertices', () => {
  it('returns vertices for a hex', () => {
    const tiles = generateTiles()
    const { vertices } = generateVerticesAndEdges(tiles, HEX_SIZE, BOARD_CENTER)
    const hexId = Object.keys(tiles)[0]
    const hexVerts = getHexVertices(hexId, vertices)
    expect(hexVerts.length).toBe(6)
  })
})
