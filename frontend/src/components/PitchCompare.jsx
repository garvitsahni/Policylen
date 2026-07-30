import { useState } from 'react'

const SEVERITY_COLORS = {
  contradiction: { bg: 'bg-sindoor/5', border: 'border-sindoor/20', icon: '✗', text: 'text-sindoor' },
  warning: { bg: 'bg-turmeric/5', border: 'border-turmeric/20', icon: '△', text: 'text-turmeric' },
  match: { bg: 'bg-neem/5', border: 'border-neem/20', icon: '✓', text: 'text-neem' },
}

export function PitchCompare({ documentId }) {
  const [pitchText, setPitchText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  if (!documentId) return null

  const comparePitch = async () => {
    if (!pitchText.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/pitch-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, pitchText: pitchText.trim() }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const testPitches = [
    { label: 'No co-pay, no waiting', text: 'This policy has zero copay and covers pre-existing from day 1!' },
    { label: 'Unlimited room, cashless everywhere', text: 'You get unlimited room, all hospitals are cashless!' },
    { label: 'Maternity covered', text: 'Maternity is fully covered, including delivery and newborn care!' },
  ]

  return (
    <div className="bg-ledger-paper border border-kraft rounded-lg p-5">
      <div className="font-serif-custom text-lg mb-1">Sales Pitch vs. Document</div>
      <p className="text-xs text-ledger-indigo/50 mb-4">Paste an agent's claim — PolicyLens checks it against the actual document.</p>

      <textarea
        className="w-full border border-kraft rounded-lg p-3 text-sm font-mono-custom resize-y min-h-[80px]"
        placeholder="Paste a salesperson's pitch here, e.g.: 'This policy has zero copay and covers pre-existing from day 1!'"
        value={pitchText}
        onChange={(e) => setPitchText(e.target.value)}
      />

      <div className="flex flex-wrap gap-2 mt-2">
        {testPitches.map((p) => (
          <button
            key={p.label}
            className="text-xs px-2 py-1 rounded bg-kraft border border-ledger-indigo/20 hover:bg-ledger-indigo/10 transition-colors"
            onClick={() => setPitchText(p.text)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        className="mt-3 px-4 py-2 bg-ledger-indigo text-ledger-paper rounded-lg text-sm font-medium hover:bg-ledger-indigo/90 transition-colors disabled:opacity-50"
        onClick={comparePitch}
        disabled={loading || !pitchText.trim()}
      >
        {loading ? 'Comparing...' : 'Compare Pitch'}
      </button>

      {result && result.error && (
        <div className="mt-4 p-3 bg-sindoor/5 border border-sindoor/20 rounded-lg text-sm text-sindoor">{result.error}</div>
      )}

      {result && result.contradictions && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-sindoor/10 text-sindoor">{result.summary.contradictions} contradictions</span>
            <span className="px-2 py-0.5 rounded bg-turmeric/10 text-turmeric">{result.summary.warnings} warnings</span>
            <span className="px-2 py-0.5 rounded bg-neem/10 text-neem">{result.summary.matches} matches</span>
          </div>

          {result.contradictions.map((c, i) => {
            const colors = SEVERITY_COLORS[c.severity] || SEVERITY_COLORS.warning
            return (
              <div key={i} className={`${colors.bg} border ${colors.border} rounded-lg p-3`}>
                <div className="flex items-start gap-2">
                  <span className={`font-mono-custom font-bold ${colors.text}`}>{colors.icon}</span>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${colors.text}`}>
                      {c.severity === 'match' ? 'Confirmed' : c.severity === 'warning' ? 'Unverified' : 'Contradiction'}
                    </div>
                    <p className="text-sm mt-1">{c.explanation}</p>
                    <div className="mt-2 space-y-1 text-xs text-ledger-indigo/60">
                      <div><span className="font-semibold">Claim:</span> "{c.claimText}"</div>
                      <div><span className="font-semibold">Document says:</span> {c.documentValue}</div>
                      {c.sourceExcerpt && (
                        <div className="mt-1 p-2 bg-ledger-paper rounded border border-ledger-indigo/10">
                          <span className="font-semibold">Source:</span> {c.sourceExcerpt}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}