import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STAGES = [
  { label: 'Reading document…', duration: 2000, icon: '📄' },
  { label: 'Extracting clauses…', duration: 3000, icon: '🔍' },
  { label: 'Matching against taxonomy…', duration: 2500, icon: '⚖️' },
  { label: 'Calculating your risk…', duration: 2000, icon: '🧮' },
  { label: 'Generating report…', duration: 1500, icon: '📋' },
]

const REASSURANCE_DELAY = 45000

export function ProcessingOverlay({ visible, onComplete }) {
  const [stageIndex, setStageIndex] = useState(0)
  const [showReassurance, setShowReassurance] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!visible) {
      setStageIndex(0)
      setShowReassurance(false)
      setProgress(0)
      return
    }

    const totalDuration = STAGES.reduce((sum, s) => sum + s.duration, 0)
    let elapsed = 0

    const interval = setInterval(() => {
      elapsed += 100
      const pct = Math.min((elapsed / totalDuration) * 100, 95)
      setProgress(pct)

      let acc = 0
      for (let i = 0; i < STAGES.length; i++) {
        acc += STAGES[i].duration
        if (elapsed <= acc) {
          setStageIndex(i)
          break
        }
      }
    }, 100)

    const reassuranceTimer = setTimeout(() => {
      setShowReassurance(true)
    }, REASSURANCE_DELAY)

    const completeTimer = setTimeout(() => {
      clearInterval(interval)
      setProgress(100)
      if (onComplete) onComplete()
    }, totalDuration + 500)

    return () => {
      clearInterval(interval)
      clearTimeout(reassuranceTimer)
      clearTimeout(completeTimer)
    }
  }, [visible, onComplete])

  if (!visible) return null

  return (
    <motion.div
      className="premium-card p-6 relative overflow-hidden"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-ledger-indigo via-turmeric to-neem" />

      {/* Skeleton flag card layout */}
      <div className="space-y-4 mb-6">
        <motion.div
          className="h-4 w-28 bg-kraft rounded-lg shimmer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        />
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="flex items-start gap-3 p-3 border border-kraft rounded-xl"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.3 }}
          >
            <div className="w-9 h-9 rounded-full shimmer shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-kraft rounded shimmer" />
              <div className="h-3 w-full bg-kraft rounded shimmer" />
              <div className="h-3 w-3/4 bg-kraft rounded shimmer" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stage labels */}
      <div className="space-y-2 mb-4">
        {STAGES.map((stage, i) => {
          const isDone = i < stageIndex
          const isCurrent = i === stageIndex
          return (
            <motion.div
              key={i}
              className="flex items-center gap-3 text-sm"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
            >
              <motion.span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  isDone
                    ? 'bg-neem text-white'
                    : isCurrent
                    ? 'bg-ledger-indigo text-white'
                    : 'bg-kraft/50 text-ledger-indigo/30'
                }`}
                animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
                transition={isCurrent ? { repeat: Infinity, duration: 1.5 } : {}}
              >
                {isDone ? '✓' : isCurrent ? '●' : '○'}
              </motion.span>
              <span className={`flex-1 ${isDone ? 'text-ledger-indigo/80' : isCurrent ? 'text-ledger-indigo font-medium' : 'text-ledger-indigo/30'}`}>
                {stage.label}
              </span>
              {isCurrent && (
                <motion.span
                  className="text-xs text-ledger-indigo/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {stage.icon}
                </motion.span>
              )}
              {isDone && (
                <span className="text-[10px] text-neem/60 font-mono">done</span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Determinate progress bar */}
      <div className="h-1.5 w-full bg-kraft rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-ledger-indigo via-turmeric to-neem"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Reassurance message */}
      <AnimatePresence>
        {showReassurance && (
          <motion.div
            className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2"
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="mt-0.5">⏳</span>
            <span>Complex policies take a little longer — still working. Thanks for your patience.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}