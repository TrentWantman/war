import type { Resources, ResourceType } from '../../types/game'
import { RESOURCE_CONFIG } from '../../utils/hexGrid'

interface ResourceDisplayProps {
  resources: Resources
  compact?: boolean
  showZero?: boolean
}

export function ResourceDisplay({ resources, compact = false, showZero = true }: ResourceDisplayProps) {
  const entries = (Object.entries(resources) as [ResourceType, number][])
    .filter(([, count]) => showZero || count > 0)

  if (compact) {
    return (
      <div className="flex gap-1 flex-wrap">
        {entries.map(([type, count]) => {
          const cfg = RESOURCE_CONFIG[type]
          return (
            <span
              key={type}
              title={cfg.label}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold"
              style={{ background: cfg.bgColor, color: cfg.color, border: `1px solid ${cfg.color}40` }}
            >
              <span className="text-xs">{cfg.icon}</span>
              <span>{count}</span>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-5 gap-1">
      {entries.map(([type, count]) => {
        const cfg = RESOURCE_CONFIG[type]
        return (
          <div
            key={type}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg"
            style={{ background: cfg.bgColor, border: `1px solid ${cfg.color}40` }}
          >
            <span className="text-lg">{cfg.icon}</span>
            <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
            <span className="text-lg font-bold text-white">{count}</span>
          </div>
        )
      })}
    </div>
  )
}
