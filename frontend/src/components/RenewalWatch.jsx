import { useState } from 'react'

const CHANGE_COLORS = {
  positive: { bg: 'bg-neem/5', border: 'border-neem/20', text: 'text-neem', icon: '↑' },
  negative: { bg: 'bg-sindoor/5', border: 'border-sindoor/20', text: 'text-sindoor', icon: '↓' },
  neutral: { bg: 'bg-kraft/30', border: 'border-kraft', text: 'text-ledger-indigo/50', icon: '→' },
}

const FLAG_CHANGE_COLORS = {
  new: { bg: 'bg-sindoor/5', text: 'text-sindoor', label: 'New' },
  removed: { bg: 'bg-neem/5', text: 'text-neem', label: 'Removed' },
  worsened: { bg: 'bg-turmeric/5', text: 'text-turmeric', label: 'Worsened' },
  improved: { bg: 'bg-neem/5', text: 'text-neem', label: 'Improved' },
  unchanged: { bg: 'bg-kraft/20', text: 'text-ledger-indigo/30', label: '' },
}

export function RenewalWatch({ documentId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchRenewal = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/renewal-watch/${documentId || 'demo'}`)
      const json = await res.json()
      if (json.success) setData(json)
    } catch {
      setData({ error: true, versions: [], impact: { scoreDiff: 0, summary: '' } })
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (score) => score >= 70 ? 'text-neem' : score >= 40 ? 'text-turmeric' : 'text-sindoor'

  return (
    <div className="bg-ledger-paper border border-kraft rounded-lg p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="font-serif-custom text-lg">Renewal Watch</div>
          <p className="text-xs text-ledger-indigo/50">Track what changed when you renewed</p>
        </div>
        {!data && (
          <button
            className="px-4 py-2 bg-ledger-indigo text-ledger-paper rounded-lg text-sm font-medium hover:bg-ledger-indigo/90 transition-colors disabled:opacity-50"
            onClick={fetchRenewal}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load Demo'}
          </button>
        )}
      </div>

      {data && data.versions && (
        <div className="mt-4 space-y-5">
          {/* Summary banner */}
          <div className={`p-3 rounded-lg text-sm border ${
            data.impact.scoreDiff < 0
              ? 'bg-sindoor/5 border-sindoor/20 text-sindoor'
              : data.impact.scoreDiff > 0
              ? 'bg-neem/5 border-neem/20 text-neem'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <div className="font-semibold">
              Score: {data.versions[0].score} → {data.versions[1].score}
              <span className="ml-2">({data.impact.scoreDiff > 0 ? '+' : ''}{data.impact.scoreDiff})</span>
            </div>
            <p className="mt-1 text-xs">{data.impact.summary}</p>
          </div>

          {/* Side-by-side version comparison */}
          <div className="grid grid-cols-2 gap-3">
            {data.versions.map((v, idx) => (
              <div key={v.version} className={`p-3 rounded-lg border ${idx === 0 ? 'bg-kraft border-ledger-indigo/20' : 'bg-white border-stamp-navy/30'}`}>
                <div className="text-xs font-semibold text-ledger-indigo/60">{v.year}</div>
                <div className={`font-mono-custom text-3xl font-bold mt-1 ${scoreColor(v.score)}`}>{v.score}</div>
                <div className="text-xs mt-2 space-y-0.5">
                  <div>SI: ₹{v.sumInsured.toLocaleString('en-IN')}</div>
                  <div>Premium: ₹{v.premium.toLocaleString('en-IN')}/yr</div>
                </div>
              </div>
            ))}
          </div>

          {/* Changes table */}
          <div>
            <div className="text-sm font-semibold text-ledger-indigo/70 mb-2">What Changed</div>
            <div className="space-y-1.5">
              {data.versions[1].changes.map((change, i) => {
                const colors = CHANGE_COLORS[change.impact] || CHANGE_COLORS.neutral
                return (
                  <div key={i} className={`${colors.bg} border ${colors.border} rounded-lg p-2.5 text-xs`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{change.field}</span>
                      <span className={`font-mono-custom font-bold ${colors.text}`}>{colors.icon}</span>
                    </div>
                    <div className="mt-1 text-ledger-indigo/60">
                      <span className="line-through opacity-60">{change.before}</span>
                      {' → '}
                      <span className="font-medium">{change.after}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Flags diff */}
          <div>
            <div className="text-sm font-semibold text-ledger-indigo/70 mb-2">Flag Changes</div>
            <div className="space-y-1">
              {data.versions[1].flags.map((flag) => {
                const fc = FLAG_CHANGE_COLORS[flag.changed] || FLAG_CHANGE_COLORS.unchanged
                if (flag.changed === 'unchanged') return null
                return (
                  <div key={flag.ruleId} className={`${fc.bg} rounded-lg px-2.5 py-1.5 text-xs flex items-start gap-2`}>
                    <span className={`font-bold mt-0.5 ${fc.text}`}>{fc.label}</span>
                    <span className="text-ledger-indigo/80">{flag.description}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {data && data.note && (
        <div className="mt-4 text-[10px] text-ledger-indigo/30 text-center">{data.note}</div>
      )}
    </div>
  )
}