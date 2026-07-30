import { useState } from 'react'

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

const FLAG_LABELS = {
  R01: 'Room Rent Capping', R02: 'Disease Sub-limit', R03: 'Co-payment',
  R04: 'PED Waiting Period', R05: 'Initial Waiting', R06: 'Specific Disease Wait',
  R07: 'Non-disclosure Clause', R08: 'Sole Discretion', R09: 'Ancillary Sub-limit',
  R10: 'Non-network Reduction', R11: 'Renewal Loading', R12: 'Permanent Exclusions',
  R13: 'Claim Intimation Deadline',
  G01: 'No Room Rent Cap', G02: 'No Co-pay', G03: 'Short PED Wait',
  G04: 'Restoration Benefit', G05: 'No Sub-limits', G06: 'Cumulative Bonus',
  G07: 'Cashless Network',
}

function SeverityPill({ flag }) {
  if (!flag) {
    return <span className="text-xs text-ledger-indigo/30 italic">—</span>
  }
  const isRed = flag.colorType === 'red'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      isRed ? 'bg-sindoor/10 text-sindoor' : 'bg-neem/10 text-neem'
    }`}>
      {flag.taxonomyId}
    </span>
  )
}

function ScoreBar({ score, maxScore = 100 }) {
  const pct = (score / maxScore) * 100
  let barColor = 'bg-sindoor'
  if (pct >= 70) barColor = 'bg-neem'
  else if (pct >= 40) barColor = 'bg-turmeric'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-kraft rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono-custom text-sm font-bold min-w-[2rem] text-right">{score}</span>
    </div>
  )
}

function ScoreCard({ doc, highlight }) {
  return (
    <div className={`p-4 rounded-lg border ${highlight ? 'bg-ledger-indigo/5 border-ledger-indigo' : 'bg-ledger-paper border-ledger-indigo/20'}`}>
      <div className="text-sm font-medium text-ledger-indigo mb-1 truncate" title={doc.fileName}>
        {doc.insurerName || doc.fileName}
      </div>
      <div className="text-xs text-ledger-indigo/50 mb-3 truncate">{doc.fileName}</div>
      <ScoreBar score={doc.score} maxScore={100} />
      {doc.settlementRatio !== null && doc.settlementRatio !== undefined && (
        <div className="mt-2 text-xs text-ledger-indigo/60">
          <span className="font-medium">ICR:</span> {doc.settlementRatio.toFixed(1)}%
        </div>
      )}
      {(!doc.settlementRatio && doc.settlementRatio !== 0) && (
        <div className="mt-2 text-xs text-turmeric italic">Reference data N/A</div>
      )}
    </div>
  )
}

export function ComparisonView({ documentIds }) {
  const [comparison, setComparison] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleCompare() {
    if (!documentIds || documentIds.length < 2) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/documents/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Compare failed')
      }
      const data = await res.json()
      setComparison(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif-custom text-xl font-bold text-ledger-indigo">Compare Policies</h2>
        {documentIds && documentIds.length >= 2 && (
          <button
            onClick={handleCompare}
            disabled={isLoading}
            className="px-4 py-2 bg-ledger-indigo text-ledger-paper rounded-lg text-sm font-medium hover:bg-ledger-indigo/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Comparing...' : `Compare ${documentIds.length} Policies`}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-sindoor/10 border border-sindoor/30 rounded-lg p-3 text-sm text-sindoor">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-8 text-ledger-indigo/50 text-sm animate-pulse">
          Comparing policies...
        </div>
      )}

      {comparison && (
        <div className="space-y-4">
          {/* Score overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {comparison.documents.map((doc, i) => (
              <ScoreCard key={doc.documentId} doc={doc} highlight={i === 0} />
            ))}
          </div>

          {/* Flags summary */}
          <div className="bg-kraft/30 rounded-lg p-3 flex gap-4 text-xs">
            <span className="text-ledger-indigo/60">
              Total flag patterns: <strong>{comparison.flagsSummary.total}</strong>
            </span>
            <span className="text-sindoor">
              Different: <strong>{comparison.flagsSummary.differing}</strong>
            </span>
            <span className="text-ledger-indigo/40">
              Same: <strong>{comparison.flagsSummary.identical}</strong>
            </span>
          </div>

          {/* Materiallly differing flags table */}
          {comparison.materiallyDifferentFlags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-sindoor mb-2">
                Material Differences ({comparison.materiallyDifferentFlags.length})
              </h3>
              <div className="overflow-x-auto border border-kraft/50 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-kraft/30">
                      <th className="text-left p-3 text-xs font-medium text-ledger-indigo/60">Flag</th>
                      {comparison.documents.map(doc => (
                        <th key={doc.documentId} className="text-center p-3 text-xs font-medium text-ledger-indigo/60">
                          {doc.insurerName || doc.fileName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.materiallyDifferentFlags.map((f) => (
                      <tr key={f.taxonomyId} className="border-t border-kraft/30 hover:bg-ledger-indigo/5">
                        <td className="p-3 font-medium whitespace-nowrap">
                          <span className="text-xs text-ledger-indigo/40">{f.taxonomyId}</span>
                          <span className="ml-2">{FLAG_LABELS[f.taxonomyId] || ''}</span>
                        </td>
                        {f.perDocument.map((flag, i) => (
                          <td key={i} className="p-3 text-center">
                            <SeverityPill flag={flag} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Identical flags (de-emphasized) */}
          {comparison.identicalFlags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ledger-indigo/40 mb-2">
                Same Across All Policies ({comparison.identicalFlags.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {comparison.identicalFlags.map(f => (
                  <span key={f.taxonomyId} className="text-xs text-ledger-indigo/30 px-2 py-0.5 rounded bg-kraft/20">
                    {f.taxonomyId}
                    {f.commonState && f.commonState !== 'absent' && ` (${f.commonState.colorType === 'red' ? 'red' : 'green'})`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!comparison && !isLoading && (!documentIds || documentIds.length < 2) && (
        <div className="bg-kraft/40 rounded-lg p-6 text-center">
          <div className="font-serif-custom text-lg mb-2 text-ledger-indigo/70">Compare Side by Side</div>
          <p className="text-sm text-ledger-indigo/50">
            Upload and process at least 2 policy documents to compare their coverage side by side.
            Materially different flags will be highlighted.
          </p>
        </div>
      )}
    </div>
  )
}