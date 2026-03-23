import { useRef, useEffect, useCallback, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useShallow } from 'zustand/react/shallow'
import { hexCorners, tileCenter, hexSizeForMap } from '../../utils/hexGrid'
import { PLAYER_HEX_COLORS, BOARD_CENTER } from '../../constants/colors'
import { TERRAIN_COLORS } from '../../constants/resources'
import type { HexTile, Vertex, Edge, Point, PlayerColor } from '../../types/game'

function buildPlayerColorMap(players: Record<string, { color: PlayerColor }>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [id, player] of Object.entries(players)) {
    map[id] = PLAYER_HEX_COLORS[player.color]
  }
  return map
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  center: Point,
  size: number,
  tile: HexTile,
  isHovered: boolean,
  isRobberTarget: boolean
) {
  const verts = hexCorners(center, size)
  const colors = TERRAIN_COLORS[tile.terrain]

  ctx.beginPath()
  ctx.moveTo(verts[0].x, verts[0].y)
  for (let i = 1; i < 6; i++) ctx.lineTo(verts[i].x, verts[i].y)
  ctx.closePath()

  ctx.fillStyle = isRobberTarget ? colors.dark : colors.fill
  ctx.fill()

  ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(0,0,0,0.4)'
  ctx.lineWidth = isHovered ? 2.5 : 1.5
  ctx.stroke()
}

function drawTerrainLabel(ctx: CanvasRenderingContext2D, center: Point, terrain: string) {
  const labels: Record<string, string> = {
    food: 'FLD', weapons: 'QRY', ammo: 'MTN', tools: 'FOR', supplies: 'PST', desert: 'DST',
  }
  const label = labels[terrain] ?? ''
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillText(label, center.x, center.y + (terrain === 'desert' ? 0 : -22))
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
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fill()
    ctx.fillStyle = '#ef4444'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('R', center.x, center.y)
    return
  }
  if (!number) return

  const isRed = number === 6 || number === 8
  const radius = 18

  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,240,0.95)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = isRed ? '#dc2626' : '#1a1a1a'
  ctx.font = `bold ${number >= 10 ? '13' : '15'}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(number), center.x, center.y - 1)

  const dots = number <= 7 ? number - 1 : 13 - number
  const dotY = center.y + 8
  const dotSpacing = 4
  const startX = center.x - ((dots - 1) * dotSpacing) / 2
  for (let i = 0; i < dots; i++) {
    ctx.beginPath()
    ctx.arc(startX + i * dotSpacing, dotY, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = isRed ? '#dc2626' : '#555'
    ctx.fill()
  }
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
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('O', pos.x, pos.y)
    } else {
      ctx.beginPath()
      const s = 10
      ctx.rect(pos.x - s, pos.y - s, s * 2, s * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('B', pos.x, pos.y)
    }
    return
  }

  const showIndicator =
    (phase === 'setup' && setupSubPhase === 'place_outpost') ||
    (phase === 'playing')

  if (showIndicator && isValid) {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, isHovered ? 9 : 6, 0, Math.PI * 2)
    ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'
    ctx.fill()
    ctx.strokeStyle = isHovered ? '#fff' : 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1.5
    ctx.stroke()
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
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(va.position.x, va.position.y)
    ctx.lineTo(vb.position.x, vb.position.y)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
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
    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'
    ctx.lineWidth = isHovered ? 4 : 2.5
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

function drawPort(ctx: CanvasRenderingContext2D, vertex: Vertex) {
  if (!vertex.portType) return
  const { position: pos } = vertex

  const portLabels: Record<string, string> = {
    food: 'F 2:1', weapons: 'W 2:1', ammo: 'A 2:1',
    tools: 'T 2:1', supplies: 'S 2:1', generic: '? 3:1',
  }
  const label = portLabels[vertex.portType]
  if (!label) return

  ctx.beginPath()
  ctx.arc(pos.x, pos.y, 13, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(30, 40, 60, 0.9)'
  ctx.fill()
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = '#e2e8f0'
  ctx.font = '8px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, pos.x, pos.y)
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

interface HexBoardProps {
  width?: number
  height?: number
}

export function HexBoard({ width = 700, height = 620 }: HexBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [localHoverId, setLocalHoverId] = useState<{ type: 'vertex' | 'edge' | 'tile'; id: string } | null>(null)

  const game = useGameStore(s => s.game)
  const selectedMapId = useGameStore(s => s.selectedMapId)
  const hexSize = hexSizeForMap(selectedMapId)
  const validOutposts = useGameStore(useShallow(s => s.getValidOutpostVertices()))
  const validRoutes = useGameStore(useShallow(s => s.getValidRouteEdges()))
  const validBases = useGameStore(useShallow(s => s.getValidBaseVertices()))
  const clickVertex = useGameStore(s => s.clickVertex)
  const clickEdge = useGameStore(s => s.clickEdge)
  const clickTile = useGameStore(s => s.clickTile)

  const draw = useCallback(() => {
    if (!game) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const { tiles, vertices, edges, phase, setupSubPhase } = game
    const playerColorMap = buildPlayerColorMap(game.players)

    ctx.fillStyle = '#0a192f'
    ctx.fillRect(0, 0, width, height)

    for (const tile of Object.values(tiles)) {
      const center = tileCenter(tile, hexSize, BOARD_CENTER)
      const isHovered = localHoverId?.type === 'tile' && localHoverId.id === tile.id
      const isRobberTarget = phase === 'robber' && isHovered
      drawHex(ctx, center, hexSize, tile, isHovered, isRobberTarget)
    }

    for (const tile of Object.values(tiles)) {
      const center = tileCenter(tile, hexSize, BOARD_CENTER)
      drawTerrainLabel(ctx, center, tile.terrain)
      drawNumberToken(ctx, center, tile.number, tile.hasRobber)
    }

    for (const vertex of Object.values(vertices)) {
      if (vertex.hexIds.length <= 2 && vertex.portType) {
        drawPort(ctx, vertex)
      }
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
  }, [game, localHoverId, validOutposts, validRoutes, validBases, width, height, hexSize])

  useEffect(() => { draw() }, [draw])

  const hitTestCanvas = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!game) return null
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const x = (e.clientX - rect.left) * (canvas.width / rect.width / dpr)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height / dpr)

    const { vertices, edges, tiles, phase } = game

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

    const { setupSubPhase } = game
    const showVertices = (phase === 'setup' && setupSubPhase === 'place_outpost') || phase === 'playing'
    if (showVertices) {
      for (const vertex of Object.values(vertices)) {
        const dx = x - vertex.position.x
        const dy = y - vertex.position.y
        if (Math.sqrt(dx * dx + dy * dy) < 12) {
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
        if (dist < 8) {
          return { type: 'edge' as const, id: edge.id }
        }
      }
    }

    return null
  }, [game])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTestCanvas(e)
    setLocalHoverId(hit)
  }, [hitTestCanvas])

  const handleMouseLeave = useCallback(() => {
    setLocalHoverId(null)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!game) return
    const currentPlayer = game.players[game.playerOrder[game.currentPlayerIndex]]
    if (currentPlayer.isAI) return
    const hit = hitTestCanvas(e)
    if (!hit) return
    if (hit.type === 'vertex') clickVertex(hit.id)
    else if (hit.type === 'edge') clickEdge(hit.id)
    else if (hit.type === 'tile') clickTile(hit.id)
  }, [game, hitTestCanvas, clickVertex, clickEdge, clickTile])

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ cursor: localHoverId ? 'pointer' : 'default', display: 'block' }}
      className="rounded-xl border border-white/10 shadow-2xl"
    />
  )
}
