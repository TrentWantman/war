import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { RESOURCE_COLORS, RESOURCE_LABELS } from '../../constants/resources'
import type { ResourceType, DevCardType } from '../../types/game'

const RESOURCE_TYPES: ResourceType[] = ['food', 'weapons', 'ammo', 'tools', 'supplies']

const TERRAIN_ART: Record<ResourceType, (ctx: CanvasRenderingContext2D, x: number, y: number) => void> = {
  food: (ctx, x, y) => {
    ctx.strokeStyle = '#8b6914'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 5; i++) {
      const lx = x - 8 + i * 4
      ctx.beginPath()
      ctx.moveTo(lx, y + 4)
      ctx.lineTo(lx, y - 6)
      ctx.lineTo(lx - 2, y - 10)
      ctx.moveTo(lx, y - 6)
      ctx.lineTo(lx + 2, y - 10)
      ctx.stroke()
    }
  },
  weapons: (ctx, x, y) => {
    ctx.fillStyle = '#8b2020'
    ctx.fillRect(x - 8, y - 4, 16, 10)
    ctx.fillRect(x - 6, y - 8, 12, 4)
    ctx.fillStyle = '#6b1010'
    ctx.fillRect(x - 4, y - 2, 8, 6)
  },
  ammo: (ctx, x, y) => {
    ctx.fillStyle = '#525960'
    ctx.beginPath()
    ctx.moveTo(x, y - 10)
    ctx.lineTo(x - 10, y + 4)
    ctx.lineTo(x + 10, y + 4)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#6b7280'
    ctx.beginPath()
    ctx.moveTo(x, y - 6)
    ctx.lineTo(x - 6, y + 2)
    ctx.lineTo(x + 6, y + 2)
    ctx.closePath()
    ctx.fill()
  },
  tools: (ctx, x, y) => {
    ctx.fillStyle = '#1a5c1d'
    ctx.beginPath()
    ctx.moveTo(x, y - 12)
    ctx.lineTo(x - 8, y + 2)
    ctx.lineTo(x + 8, y + 2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#5c3a1e'
    ctx.fillRect(x - 1.5, y + 2, 3, 6)
  },
  supplies: (ctx, x, y) => {
    ctx.fillStyle = '#4ade80'
    ctx.beginPath()
    ctx.arc(x, y - 2, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.arc(x - 3, y - 4, 5, 0, Math.PI * 2)
    ctx.fill()
  },
}

function ResourceCard({ type, count }: { type: ResourceType; count: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [flash, setFlash] = useState(false)
  const prevCount = useRef(count)

  useEffect(() => {
    if (count > prevCount.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      prevCount.current = count
      return () => clearTimeout(t)
    }
    prevCount.current = count
  }, [count])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = 52 * dpr
    canvas.height = 68 * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = count > 0 ? '#1a1f2e' : '#0d1017'
    ctx.beginPath()
    ctx.roundRect(1, 1, 50, 66, 4)
    ctx.fill()

    const color = RESOURCE_COLORS[type]
    ctx.strokeStyle = count > 0 ? color : color + '30'
    ctx.lineWidth = count > 0 ? 2 : 1
    ctx.beginPath()
    ctx.roundRect(1, 1, 50, 66, 4)
    ctx.stroke()

    ctx.globalAlpha = count > 0 ? 1 : 0.25
    TERRAIN_ART[type](ctx, 26, 28)
    ctx.globalAlpha = 1

    ctx.fillStyle = count > 0 ? color : color + '40'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(RESOURCE_LABELS[type].toUpperCase(), 26, 50)

    ctx.fillStyle = count > 0 ? '#fff' : '#ffffff30'
    ctx.font = 'bold 16px monospace'
    ctx.fillText(String(count), 26, 14)
  }, [type, count])

  return (
    <motion.div
      animate={flash ? { scale: [1, 1.15, 1], filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1)'] } : {}}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <canvas
        ref={canvasRef}
        style={{ width: 52, height: 68, display: 'block' }}
      />
    </motion.div>
  )
}

const DEV_CARD_LABELS: Record<DevCardType, { name: string; color: string }> = {
  soldier:        { name: 'SOLDIER',  color: '#ef4444' },
  road_building:  { name: 'ROADS',    color: '#f59e0b' },
  year_of_plenty: { name: 'PLENTY',   color: '#22c55e' },
  monopoly:       { name: 'MONOPOLY', color: '#a78bfa' },
  victory_point:  { name: 'VP',       color: '#eab308' },
}

function DevCard({ type, count }: { type: DevCardType; count: number }) {
  const info = DEV_CARD_LABELS[type]
  return (
    <div
      className="flex flex-col items-center justify-center rounded px-2 py-1"
      style={{
        background: info.color + '15',
        border: `1px solid ${info.color}40`,
        minWidth: 48,
      }}
    >
      <span className="text-xs font-bold" style={{ color: info.color }}>{count}</span>
      <span style={{ color: info.color, fontSize: 7, fontFamily: 'monospace' }}>{info.name}</span>
    </div>
  )
}

export function ResourceCards() {
  const game = useGameStore(s => s.game)
  const localPlayerId = useGameStore(s => s.localPlayerId)
  const isMultiplayer = useGameStore(s => s.isMultiplayer)

  if (!game) return null

  const playerId = isMultiplayer && localPlayerId
    ? localPlayerId
    : game.playerOrder[game.currentPlayerIndex]
  const player = game.players[playerId]
  if (!player) return null

  const devCounts: Partial<Record<DevCardType, number>> = {}
  for (const card of player.devCards) {
    devCounts[card] = (devCounts[card] ?? 0) + 1
  }
  const devEntries = Object.entries(devCounts) as [DevCardType, number][]

  return (
    <div className="flex items-center gap-1">
      {RESOURCE_TYPES.map(r => (
        <ResourceCard key={r} type={r} count={player.resources[r]} />
      ))}
      <AnimatePresence>
        {devEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-1 ml-2 pl-2"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}
          >
            {devEntries.map(([type, count]) => (
              <DevCard key={type} type={type} count={count} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
