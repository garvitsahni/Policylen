import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const severityConfig = {
  red: { label: 'Critical Restriction', color: '#ba1a1a', dot: 'bg-error' },
  amber: { label: 'Standard Exclusion', color: '#C68A1F', dot: 'bg-amber-600' },
  green: { label: 'Favorable Clause', color: '#42663B', dot: 'bg-neem' },
}

function FlagCard({ flag }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = severityConfig[flag.colorType] || severityConfig.red
  const taxonomyId = flag.taxonomyId || 'N/A'
  const verified = flag.confidence === 'high'
  const stampLabel = verified ? `${taxonomyId} \u00b7 VERIFIED` : `${taxonomyId} \u00b7 PENDING`

  return (
    <div className="bg-paper p-6 rounded-xl border border-primary relative overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <div
        className={`absolute top-4 right-4 font-bold stamp-effect uppercase text-xs z-10 ${verified ? 'text-error' : 'text-amber-600'}`}
      >
        {stampLabel}
      </div>
      <div className="flex items-start gap-4 cursor-pointer" onClick={() => setExpanded(!expanded)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }} role="button" tabIndex={0} aria-expanded={expanded}>
        <div className={`h-4 w-4 rounded-full ${cfg.dot} mt-1 shrink-0`} />
        <div className="flex-grow min-w-0">
          <h3 className="font-label-md text-label-md uppercase mb-1 font-semibold tracking-wider" style={{ color: cfg.color }}>
            {cfg.label}
          </h3>
          <p className="text-body-lg text-body-lg text-primary mb-3">{flag.explanation}</p>
          {flag.rupeeAtRisk != null && (
            <div className="flex items-baseline justify-between border-b border-primary/10 pb-1">
              <span className="font-body-md text-body-md text-on-surface-variant flex items-center dot-leader">Potential Rupee-at-Risk</span>
              <span className="font-figure-mono text-figure-mono font-bold shrink-0" style={{ color: cfg.color }}>
                {'\u20B9'}{(flag.rupeeAtRisk / 100000).toFixed(1)}L
              </span>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-primary/10 space-y-3">
              {flag.sourceExcerpt && (
                <div>
                  <div className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wider mb-1">Source (Page {flag.pageNumber || 'N/A'})</div>
                  <div className="text-sm bg-kraft/30 p-3 rounded border border-kraft italic text-on-surface leading-relaxed">
                    &ldquo;{flag.sourceExcerpt}&rdquo;
                  </div>
                </div>
              )}
              {flag.notes && (
                <div className="text-xs text-on-surface-variant/50">{flag.notes}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FlagCardList({ flags }) {
  return (
    <div className="flex flex-col gap-4">
      {flags.map((f, i) => (
        <FlagCard key={f.taxonomyId || i} flag={f} />
      ))}
    </div>
  )
}
