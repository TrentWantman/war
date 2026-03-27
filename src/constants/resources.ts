import type { ResourceType, TerrainType } from '../types/game'

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  food: 'Food',
  weapons: 'Weapons',
  ammo: 'Ammo',
  tools: 'Tools',
  supplies: 'Supplies',
}

export const RESOURCE_COLORS: Record<ResourceType, string> = {
  food: '#f59e0b',
  weapons: '#ef4444',
  ammo: '#9ca3af',
  tools: '#b45309',
  supplies: '#86efac',
}

export const RESOURCE_BG_COLORS: Record<ResourceType, string> = {
  food: 'rgba(245,158,11,0.15)',
  weapons: 'rgba(239,68,68,0.15)',
  ammo: 'rgba(156,163,175,0.15)',
  tools: 'rgba(180,83,9,0.15)',
  supplies: 'rgba(134,239,172,0.15)',
}

export const RESOURCE_SHORT_LABELS: Record<ResourceType, string> = {
  food: 'Fod',
  weapons: 'Wpn',
  ammo: 'Amo',
  tools: 'Tol',
  supplies: 'Sup',
}

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  food: 'Fields',
  weapons: 'Quarries',
  ammo: 'Mountains',
  tools: 'Forests',
  supplies: 'Pastures',
  desert: 'Desert',
}

export const RESOURCE_TYPES: ResourceType[] = ['food', 'weapons', 'ammo', 'tools', 'supplies']
