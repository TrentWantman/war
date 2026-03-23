import type { Resources, ResourceType } from '../../types/game'
import { RESOURCE_LABELS, RESOURCE_COLORS, RESOURCE_BG_COLORS, RESOURCE_SHORT_LABELS } from '../../constants/resources'

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
        {entries.map(([type, count]) => (
          <span
            key={type}
            title={RESOURCE_LABELS[type]}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold"
            style={{
              background: RESOURCE_BG_COLORS[type],
              color: RESOURCE_COLORS[type],
              border: `1px solid ${RESOURCE_COLORS[type]}40`,
            }}
          >
            <span className="text-xs">{RESOURCE_SHORT_LABELS[type]}</span>
            <span>{count}</span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-5 gap-1">
      {entries.map(([type, count]) => (
        <div
          key={type}
          className="flex flex-col items-center gap-0.5 p-2 rounded-lg"
          style={{
            background: RESOURCE_BG_COLORS[type],
            border: `1px solid ${RESOURCE_COLORS[type]}40`,
          }}
        >
          <span className="text-xs font-bold" style={{ color: RESOURCE_COLORS[type] }}>
            {RESOURCE_SHORT_LABELS[type]}
          </span>
          <span className="text-xs font-medium" style={{ color: RESOURCE_COLORS[type] }}>
            {RESOURCE_LABELS[type]}
          </span>
          <span className="text-lg font-bold text-white">{count}</span>
        </div>
      ))}
    </div>
  )
}
