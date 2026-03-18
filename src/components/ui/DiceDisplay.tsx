import { motion, AnimatePresence } from 'framer-motion'
import type { DiceRoll } from '../../types/game'

interface DiceDisplayProps {
  roll: DiceRoll | null
  rolling?: boolean
}

const dieFaces: Record<number, string> = {
  1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
}

function Die({ value, rolling }: { value: number; rolling?: boolean }) {
  return (
    <motion.div
      animate={rolling ? { rotate: [0, 360], scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-12 h-12 rounded-lg flex items-center justify-center text-3xl select-none"
      style={{
        background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
    >
      {dieFaces[value] ?? '🎲'}
    </motion.div>
  )
}

export function DiceDisplay({ roll, rolling }: DiceDisplayProps) {
  return (
    <div className="flex items-center gap-3">
      <AnimatePresence mode="wait">
        {roll ? (
          <motion.div
            key={`${roll.die1}-${roll.die2}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2"
          >
            <Die value={roll.die1} rolling={rolling} />
            <Die value={roll.die2} rolling={rolling} />
            <div className="flex flex-col items-center">
              <span className="text-white/50 text-xs">Total</span>
              <span
                className="text-2xl font-black"
                style={{ color: roll.total === 7 ? '#ef4444' : '#f59e0b' }}
              >
                {roll.total}
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            className="flex items-center gap-2 opacity-40"
          >
            <Die value={1} />
            <Die value={1} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
