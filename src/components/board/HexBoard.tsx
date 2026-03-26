import { useRef, useEffect, useCallback, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/react/shallow'
import { hexCorners, tileCenter, hexSizeForMap, cubeToPixel } from '../../utils/hexGrid'
import { PLAYER_HEX_COLORS, BOARD_CENTER } from '../../constants/colors'
import type { HexTile, Vertex, Edge, Point, PlayerColor, CubeCoord } from '../../types/game'

function getOceanCoords(landCoords: CubeCoord[]): CubeCoord[] {
  const landSet = new Set(landCoords.map(c => `${c.q},${c.r},${c.s}`))
  const oceanSet = new Set<string>()
  const dirs = [[1,-1,0],[1,0,-1],[0,1,-1],[-1,1,0],[-1,0,1],[0,-1,1]]

  for (const c of landCoords) {
    for (const [dq, dr, ds] of dirs) {
      const key = `${c.q+dq},${c.r+dr},${c.s+ds}`
      if (!landSet.has(key)) oceanSet.add(key)
    }
  }

  return [...oceanSet].map(k => {
    const [q, r, s] = k.split(',').map(Number)
    return { q, r, s }
  })
}

function drawOceanHex(ctx: CanvasRenderingContext2D, center: Point, size: number) {
  const verts = hexCorners(center, size)
  ctx.beginPath()
  ctx.moveTo(verts[0].x, verts[0].y)
  for (let i = 1; i < 6; i++) ctx.lineTo(verts[i].x, verts[i].y)
  ctx.closePath()
  ctx.fillStyle = '#0c2d48'
  ctx.fill()

  ctx.save()
  ctx.clip()
  ctx.strokeStyle = '#1a4a6e'
  ctx.lineWidth = 1
  for (let y = center.y - size; y < center.y + size; y += 8) {
    ctx.beginPath()
    ctx.moveTo(center.x - size, y + Math.sin((center.x - size) * 0.05) * 3)
    for (let x = center.x - size; x < center.x + size; x += 4) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + y * 0.02) * 3)
    }
    ctx.stroke()
  }
  ctx.restore()

  ctx.beginPath()
  ctx.moveTo(verts[0].x, verts[0].y)
  for (let i = 1; i < 6; i++) ctx.lineTo(verts[i].x, verts[i].y)
  ctx.closePath()
  ctx.strokeStyle = '#0a1f33'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

const TERRAIN_FILL: Record<string, { base: string; accent: string; pattern: string }> = {
  food:     { base: '#d4a017', accent: '#b8860b', pattern: '#c4950f' },
  weapons:  { base: '#a83232', accent: '#8b2020', pattern: '#943838' },
  ammo:     { base: '#6b7280', accent: '#4b5563', pattern: '#5c636e' },
  tools:    { base: '#2d6a30', accent: '#1e4d20', pattern: '#3a7a3e' },
  supplies: { base: '#4ade80', accent: '#22c55e', pattern: '#3dd070' },
  desert:   { base: '#c4a56e', accent: '#a88b4a', pattern: '#b89858' },
}

function buildPlayerColorMap(players: Record<string, { color: PlayerColor }>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [id, player] of Object.entries(players)) {
    map[id] = PLAYER_HEX_COLORS[player.color]
  }
  return map
}

function drawHexTerrain(
  ctx: CanvasRenderingContext2D,
  center: Point,
  size: number,
  tile: HexTile,
  isHovered: boolean,
  isRobberTarget: boolean
) {
  const verts = hexCorners(center, size)
  const t = TERRAIN_FILL[tile.terrain] ?? TERRAIN_FILL.desert

  ctx.beginPath()
  ctx.moveTo(verts[0].x, verts[0].y)
  for (let i = 1; i < 6; i++) ctx.lineTo(verts[i].x, verts[i].y)
  ctx.closePath()

  ctx.fillStyle = isRobberTarget ? t.accent : t.base
  ctx.fill()

  ctx.save()
  ctx.clip()

  ctx.fillStyle = t.pattern
  const step = 8
  for (let py = center.y - size; py < center.y + size; py += step * 2) {
    for (let px = center.x - size; px < center.x + size; px += step * 2) {
      ctx.fillRect(px, py, step, step)
    }
  }

  if (tile.terrain === 'tools') {
    ctx.fillStyle = '#1a5c1d'
    for (let i = 0; i < 5; i++) {
      const tx = center.x - 20 + i * 10
      const ty = center.y - 15 + (i % 2) * 6
      ctx.beginPath()
      ctx.moveTo(tx, ty - 8)
      ctx.lineTo(tx - 5, ty + 4)
      ctx.lineTo(tx + 5, ty + 4)
      ctx.closePath()
      ctx.fill()
    }
  }

  if (tile.terrain === 'food') {
    ctx.strokeStyle = '#8b6914'
    ctx.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      const lx = center.x - 18 + i * 7
      const ly = center.y + 10
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(lx, ly - 12)
      ctx.stroke()
    }
  }

  if (tile.terrain === 'ammo') {
    ctx.fillStyle = '#525960'
    for (let i = 0; i < 3; i++) {
      const mx = center.x - 12 + i * 12
      const my = center.y - 10
      ctx.beginPath()
      ctx.moveTo(mx, my - 10)
      ctx.lineTo(mx - 8, my + 6)
      ctx.lineTo(mx + 8, my + 6)
      ctx.closePath()
      ctx.fill()
    }
  }

  ctx.restore()

  ctx.beginPath()
  ctx.moveTo(verts[0].x, verts[0].y)
  for (let i = 1; i < 6; i++) ctx.lineTo(verts[i].x, verts[i].y)
  ctx.closePath()
  ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(0,0,0,0.5)'
  ctx.lineWidth = isHovered ? 3 : 2
  ctx.stroke()

  const terrainNames: Record<string, string> = {
    food: 'FIELDS', weapons: 'QUARRY', ammo: 'MOUNTAIN',
    tools: 'FOREST', supplies: 'PASTURE', desert: 'DESERT',
  }
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.font = 'bold 7px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(terrainNames[tile.terrain] ?? '', center.x, center.y + size * 0.55)
}

function drawNumberToken(
  ctx: CanvasRenderingContext2D,
  center: Point,
  number: number | null,
  hasRobber: boolean
) {
  if (hasRobber) {
    ctx.beginPath()
    ctx.arc(center.x, center.y, 16, 0, Math.PI * 2)
    ctx.fillStyle = '#1a1a1a'
    ctx.fill()
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#ef4444'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('X', center.x, center.y)
    return
  }
  if (!number) return

  const isRed = number === 6 || number === 8

  ctx.beginPath()
  ctx.arc(center.x, center.y, 16, 0, Math.PI * 2)
  ctx.fillStyle = '#f5f0dc'
  ctx.fill()
  ctx.strokeStyle = isRed ? '#dc2626' : '#444'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = isRed ? '#dc2626' : '#1a1a1a'
  ctx.font = `bold ${number >= 10 ? '13' : '16'}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(number), center.x, center.y - 1)

  const dots = number <= 7 ? number - 1 : 13 - number
  const dotY = center.y + 8
  const dotSpacing = 4
  const startX = center.x - ((dots - 1) * dotSpacing) / 2
  for (let i = 0; i < dots; i++) {
    ctx.fillRect(startX + i * dotSpacing - 1, dotY - 1, 2, 2)
  }
}

function drawOutpost(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - 12)
  ctx.lineTo(x - 8, y - 4)
  ctx.lineTo(x - 8, y + 8)
  ctx.lineTo(x + 8, y + 8)
  ctx.lineTo(x + 8, y - 4)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.fillRect(x - 2, y, 4, 4)
}

function drawBase(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x - 4, y - 14)
  ctx.lineTo(x - 10, y - 6)
  ctx.lineTo(x - 10, y + 8)
  ctx.lineTo(x + 10, y + 8)
  ctx.lineTo(x + 10, y - 6)
  ctx.lineTo(x + 4, y - 14)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.fillRect(x - 3, y - 2, 3, 5)
  ctx.fillRect(x + 1, y - 2, 3, 5)
}

function drawVertex(
  ctx: CanvasRenderingContext2D,
  vertex: Vertex,
  isValid: boolean,
  isHovered: boolean,
  phase: string,
  setupSubPhase: string,
  playerColorMap: Record<string, string>
) {
  const { position: pos, building } = vertex

  if (building) {
    const color = playerColorMap[building.playerId] ?? '#888'
    if (building.type === 'outpost') {
      drawOutpost(ctx, pos.x, pos.y, color)
    } else {
      drawBase(ctx, pos.x, pos.y, color)
    }
    return
  }

  const showIndicator =
    (phase === 'setup' && setupSubPhase === 'place_outpost') ||
    (phase === 'playing')

  if (showIndicator && isValid) {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, isHovered ? 10 : 6, 0, Math.PI * 2)
    ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)'
    ctx.fill()
    if (isHovered) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: Edge,
  vertices: Record<string, Vertex>,
  isValid: boolean,
  isHovered: boolean,
  phase: string,
  setupSubPhase: string,
  playerColors: Record<string, string>
) {
  const va = vertices[edge.vertexIds[0]]
  const vb = vertices[edge.vertexIds[1]]
  if (!va || !vb) return

  if (edge.road) {
    const color = playerColors[edge.road.playerId] ?? '#888'
    ctx.beginPath()
    ctx.moveTo(va.position.x, va.position.y)
    ctx.lineTo(vb.position.x, vb.position.y)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(va.position.x, va.position.y)
    ctx.lineTo(vb.position.x, vb.position.y)
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.stroke()
    return
  }

  const showIndicator =
    (phase === 'setup' && setupSubPhase === 'place_route') ||
    (phase === 'playing') ||
    (phase === 'road_building')

  if (showIndicator && isValid) {
    ctx.beginPath()
    ctx.moveTo(va.position.x, va.position.y)
    ctx.lineTo(vb.position.x, vb.position.y)
    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)'
    ctx.lineWidth = isHovered ? 5 : 3
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

const PORT_COLORS: Record<string, { text: string; color: string }> = {
  food:     { text: 'F 2:1', color: '#d4a017' },
  weapons:  { text: 'W 2:1', color: '#ef4444' },
  ammo:     { text: 'A 2:1', color: '#9ca3af' },
  tools:    { text: 'T 2:1', color: '#22c55e' },
  supplies: { text: 'S 2:1', color: '#4ade80' },
  generic:  { text: '? 3:1', color: '#60a5fa' },
}

function drawPortLabel(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  labelX: number, labelY: number,
  info: { text: string; color: string }
) {
  ctx.strokeStyle = info.color
  ctx.lineWidth = 2
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(labelX, labelY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(labelX, labelY)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = info.color + '30'
  ctx.beginPath()
  ctx.arc(x1, y1, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x2, y2, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#0a0f1a'
  ctx.strokeStyle = info.color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(labelX, labelY, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = info.color
  ctx.font = 'bold 8px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(info.text, labelX, labelY)
}

function drawPorts(
  ctx: CanvasRenderingContext2D,
  vertices: Record<string, Vertex>,
  edges: Record<string, Edge>,
  bcx: number,
  bcy: number
) {
  const drawn = new Set<string>()

  for (const edge of Object.values(edges)) {
    const va = vertices[edge.vertexIds[0]]
    const vb = vertices[edge.vertexIds[1]]
    if (!va || !vb) continue
    if (!va.portType || va.portType !== vb.portType) continue
    if (drawn.has(edge.id)) continue
    drawn.add(edge.id)

    const info = PORT_COLORS[va.portType]
    if (!info) continue

    const midX = (va.position.x + vb.position.x) / 2
    const midY = (va.position.y + vb.position.y) / 2
    const dx = midX - bcx
    const dy = midY - bcy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const labelX = midX + (dx / dist) * 35
    const labelY = midY + (dy / dist) * 35

    drawPortLabel(ctx, va.position.x, va.position.y, vb.position.x, vb.position.y, labelX, labelY, info)
  }
}

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function HexBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [localHoverId, setLocalHoverId] = useState<{ type: 'vertex' | 'edge' | 'tile'; id: string } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })

  const game = useGameStore(s => s.game)
  const selectedMapId = useGameStore(s => s.selectedMapId)
  const hexSize = hexSizeForMap(selectedMapId)
  const validOutposts = useGameStore(useShallow(s => s.getValidOutpostVertices()))
  const validRoutes = useGameStore(useShallow(s => s.getValidRouteEdges()))
  const validBases = useGameStore(useShallow(s => s.getValidBaseVertices()))
  const clickVertex = useGameStore(s => s.clickVertex)
  const clickEdge = useGameStore(s => s.clickEdge)
  const clickTile = useGameStore(s => s.clickTile)

  const getCanvasSize = useCallback(() => {
    const container = containerRef.current
    if (!container) return { w: 800, h: 600 }
    return { w: container.clientWidth, h: container.clientHeight }
  }, [])

  const draw = useCallback(() => {
    if (!game) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { w, h } = getCanvasSize()
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = '#0a0f1a'
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(w / 2 + pan.x, h / 2 + pan.y)
    ctx.scale(zoom, zoom)
    ctx.translate(-BOARD_CENTER.x, -BOARD_CENTER.y)

    const { tiles, vertices, edges, phase, setupSubPhase } = game
    const playerColorMap = buildPlayerColorMap(game.players)

    const landCoords = Object.values(tiles).map(t => t.coord)
    const oceanCoords = getOceanCoords(landCoords)
    for (const coord of oceanCoords) {
      const center = cubeToPixel(coord, hexSize, BOARD_CENTER)
      drawOceanHex(ctx, center, hexSize)
    }

    for (const tile of Object.values(tiles)) {
      const center = tileCenter(tile, hexSize, BOARD_CENTER)
      const isHovered = localHoverId?.type === 'tile' && localHoverId.id === tile.id
      const isRobberTarget = phase === 'robber' && isHovered
      drawHexTerrain(ctx, center, hexSize, tile, isHovered, isRobberTarget)
    }

    for (const tile of Object.values(tiles)) {
      const center = tileCenter(tile, hexSize, BOARD_CENTER)
      drawNumberToken(ctx, center, tile.number, tile.hasRobber)
    }

    for (const edge of Object.values(edges)) {
      const isValid = validRoutes.includes(edge.id)
      const isHovered = localHoverId?.type === 'edge' && localHoverId.id === edge.id
      drawEdge(ctx, edge, vertices, isValid, isHovered, phase, setupSubPhase, playerColorMap)
    }

    const validVertices = [...validOutposts, ...validBases]
    for (const vertex of Object.values(vertices)) {
      const isValid = validVertices.includes(vertex.id)
      const isHovered = localHoverId?.type === 'vertex' && localHoverId.id === vertex.id
      drawVertex(ctx, vertex, isValid, isHovered, phase, setupSubPhase, playerColorMap)
    }

    drawPorts(ctx, vertices, edges, BOARD_CENTER.x, BOARD_CENTER.y)

    ctx.restore()
  }, [game, localHoverId, validOutposts, validRoutes, validBases, hexSize, pan, zoom, getCanvasSize])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  const screenToWorld = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const { w, h } = getCanvasSize()
    const sx = (clientX - rect.left) * (w / rect.width)
    const sy = (clientY - rect.top) * (h / rect.height)
    const wx = (sx - w / 2 - pan.x) / zoom + BOARD_CENTER.x
    const wy = (sy - h / 2 - pan.y) / zoom + BOARD_CENTER.y
    return { x: wx, y: wy }
  }, [pan, zoom, getCanvasSize])

  const hitTest = useCallback((clientX: number, clientY: number) => {
    if (!game) return null
    const { x, y } = screenToWorld(clientX, clientY)
    const { vertices, edges, tiles, phase, setupSubPhase } = game

    if (phase === 'robber') {
      for (const tile of Object.values(tiles)) {
        const center = tileCenter(tile, hexSize, BOARD_CENTER)
        const dx = x - center.x
        const dy = y - center.y
        if (Math.sqrt(dx * dx + dy * dy) < hexSize * 0.85) {
          return { type: 'tile' as const, id: tile.id }
        }
      }
      return null
    }

    const showVertices = (phase === 'setup' && setupSubPhase === 'place_outpost') || phase === 'playing'
    if (showVertices) {
      for (const vertex of Object.values(vertices)) {
        const dx = x - vertex.position.x
        const dy = y - vertex.position.y
        if (Math.sqrt(dx * dx + dy * dy) < 14 / zoom) {
          return { type: 'vertex' as const, id: vertex.id }
        }
      }
    }

    const showEdges = (phase === 'setup' && setupSubPhase === 'place_route') || phase === 'playing' || phase === 'road_building'
    if (showEdges) {
      for (const edge of Object.values(edges)) {
        const va = vertices[edge.vertexIds[0]]
        const vb = vertices[edge.vertexIds[1]]
        if (!va || !vb) continue
        const dist = pointToSegmentDist({ x, y }, va.position, vb.position)
        if (dist < 10 / zoom) {
          return { type: 'edge' as const, id: edge.id }
        }
      }
    }

    return null
  }, [game, hexSize, screenToWorld, zoom])

  const dragStartRef = useRef({ x: 0, y: 0 })
  const didDragRef = useRef(false)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) {
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      if (Math.abs(e.clientX - dragStartRef.current.x) > 4 || Math.abs(e.clientY - dragStartRef.current.y) > 4) {
        didDragRef.current = true
      }
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    const hit = hitTest(e.clientX, e.clientY)
    setLocalHoverId(hit)
  }, [dragging, hitTest])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setDragging(true)
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    didDragRef.current = false
    if (e.button !== 0) e.preventDefault()
  }, [])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setLocalHoverId(null)
    setDragging(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.96 : 1.04
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)))
  }, [])

  const isMyTurn = useGameStore(s => s.isMyTurn)

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (didDragRef.current) return
    if (!game) return
    const currentPlayer = game.players[game.playerOrder[game.currentPlayerIndex]]
    if (currentPlayer.isAI) return
    if (!isMyTurn()) return
    const hit = hitTest(e.clientX, e.clientY)
    if (!hit) return
    if (hit.type === 'vertex') clickVertex(hit.id)
    else if (hit.type === 'edge') clickEdge(hit.id)
    else if (hit.type === 'tile') clickTile(hit.id)
  }, [game, hitTest, clickVertex, clickEdge, clickTile, isMyTurn])

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
        onClick={handleClick}
        style={{
          cursor: dragging ? 'grabbing' : localHoverId ? 'pointer' : 'grab',
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  )
}
