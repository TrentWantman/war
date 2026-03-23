import type { PlayerColor } from '../types/game'

export const PLAYER_HEX_COLORS: Record<PlayerColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
}

export const BOARD_CENTER = { x: 350, y: 310 } as const
