import { useState } from 'react'

const scenarios = [
  { id: 'heart', label: 'Emergency Heart Procedure', icon: 'emergency' },
  { id: 'cataract', label: 'Elective Cataract Surgery', icon: 'cloud_upload' },
  { id: 'maternity', label: 'Maternity (Normal Delivery)', icon: 'child_care' },
  { id: 'daycare', label: 'Diagnostic Day Care', icon: 'biotech' },
]

export function ScenarioSimulator({ documentId }) {
  const [active, setActive] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const runScenario = async (id) => {
    setActive(id)
    setLoading(true)
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, scenarioId: id }),
      })
      if (res.ok) {
        const data = await res.json()
        setResult(data)
      } else {
        setResult({
          scenario: id,
          narrative: 'Scenario simulation is not yet available through the API. This is a preview of the feature.',
          breakdown: [],
          outOfPocket: null,
        })
      }
    } catch {
      setResult({
        scenario: id,
        narrative: 'Scenario simulation is not yet available through the API. This is a preview of the feature.',
        breakdown: [],
        outOfPocket: null,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-kraft p-8 rounded-xl border-2 border-primary shadow-[8px_8px_0px_0px_rgba(2,36,72,1)]">
      <div className="mb-8">
        <h2 className="font-headline-lg text-headline-lg text-primary font-bold">Scenario Simulator</h2>
        <p className="font-body-md text-body-md text-on-secondary-fixed-variant mt-1">See how your policy responds to different medical events.</p>
      </div>
      <div className="flex flex-wrap gap-4 mb-8">
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => runScenario(s.id)}
            disabled={loading}
            className={`px-6 py-4 rounded-lg flex items-center gap-3 transition-all border ${
              active === s.id
                ? 'bg-primary text-on-primary border-primary shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]'
                : 'bg-white text-primary border-primary shadow-[4px_4px_0px_0px_rgba(2,36,72,1)] hover:-translate-y-0.5'
            } disabled:opacity-50`}
          >
            <span className="material-symbols-outlined">{s.icon}</span>
            <span className="font-label-md text-label-md">{s.label}</span>
          </button>
        ))}
      </div>
      {loading && (
        <div className="bg-paper border border-primary p-8 rounded-lg">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-primary/10 rounded w-1/4" />
            <div className="h-3 bg-primary/5 rounded w-3/4" />
            <div className="h-3 bg-primary/5 rounded w-1/2" />
          </div>
        </div>
      )}
      {result && !loading && (
        <div className="bg-paper border border-primary p-8 rounded-lg relative">
          <div className="absolute top-6 right-8 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined" style={{ fontSize: '120px' }}>medical_services</span>
          </div>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-error text-white font-bold px-2 py-1 text-xs rounded">IMPACT ALERT</span>
              <span className="text-on-surface-variant font-label-md text-label-md">Scenario ID: S-{active?.toUpperCase() || 'N/A'}</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-4 font-semibold">
              {scenarios.find(s => s.id === result.scenario)?.label || 'Scenario'} Analysis
            </h3>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed mb-8">{result.narrative}</p>
            {result.breakdown && result.breakdown.length > 0 && (
              <div className="bg-white border border-outline-variant rounded p-6 shadow-sm">
                <h4 className="font-label-md text-label-md text-primary uppercase mb-4 tracking-widest">Payment Breakdown</h4>
                <div className="space-y-3">
                  {result.breakdown.map((item, i) => (
                    <div key={i} className={`flex items-baseline justify-between ${item.highlight ? 'text-error font-bold' : ''}`}>
                      <span className="font-body-md text-body-md text-on-surface flex items-center dot-leader">{item.label}</span>
                      <span className="font-figure-mono text-figure-mono shrink-0">{item.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-error shrink-0" />
                <span className="text-xs font-label-md text-on-surface-variant uppercase">Exclusion Applied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-600 shrink-0" />
                <span className="text-xs font-label-md text-on-surface-variant uppercase">Sub-limit Hit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary shrink-0" />
                <span className="text-xs font-label-md text-on-surface-variant uppercase">Fully Covered</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
