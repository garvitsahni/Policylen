import { useState } from 'react'

const IMPACT_COLORS = {
  positive: { badge: 'bg-neem text-white', label: 'Positive' },
  negative: { badge: 'bg-sindoor text-white', label: 'Watch Out' },
  neutral: { badge: 'bg-kraft text-ledger-indigo/60', label: 'Neutral' },
}

export function CommunityClauses() {
  const [clauses, setClauses] = useState(null)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState('confirmed')
  const [loading, setLoading] = useState(false)

  const fetchClauses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('type', filter)
      if (sort) params.set('sort', sort)
      const res = await fetch(`/api/community-clauses?${params}`)
      const json = await res.json()
      if (json.success) setClauses(json)
    } catch {
      setClauses(null)
    } finally {
      setLoading(false)
    }
  }

  const clauseTypes = ['all', 'Co-pay', 'Room Rent', 'PED Waiting Period', 'Restoration', 'Maternity', 'Sub-limit', 'Day Care', 'Cashless']

  return (
    <div className="bg-ledger-paper border border-kraft rounded-lg p-5">
      <div className="font-serif-custom text-lg mb-1">Community Clause Database</div>
      <p className="text-xs text-ledger-indigo/50 mb-3">Common policy clauses confirmed by the community.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        {clauseTypes.map(t => (
          <button
            key={t}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              (t === 'all' && !filter) || filter === t
                ? 'bg-ledger-indigo text-white border-ledger-indigo'
                : 'bg-kraft border-ledger-indigo/20 hover:bg-ledger-indigo/10'
            }`}
            onClick={() => { setFilter(t === 'all' ? '' : t); setClauses(null) }}
          >
            {t === 'all' ? 'All' : t}
          </button>
        ))}
        <select
          className="text-xs px-2 py-1 border border-ledger-indigo/20 rounded bg-white"
          value={sort}
          onChange={(e) => { setSort(e.target.value); setClauses(null) }}
        >
          <option value="confirmed">Sort: Most Confirmed</option>
          <option value="impact">Sort: Best First</option>
        </select>
        <button
          className="text-xs px-3 py-1 bg-ledger-indigo text-white rounded hover:bg-ledger-indigo/90 transition-colors disabled:opacity-50"
          onClick={fetchClauses}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {/* Table */}
      {clauses && (
        <div className="space-y-2">
          <div className="text-xs text-ledger-indigo/40 mb-1">{clauses.total} clauses found</div>
          {clauses.clauses.map((c) => {
            const colors = IMPACT_COLORS[c.averageImpact] || IMPACT_COLORS.neutral
            return (
              <div key={c.id} className="border border-kraft rounded-lg p-3 hover:border-ledger-indigo/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.commonName}</div>
                    <div className="text-xs text-ledger-indigo/40 mt-0.5">{c.clauseType}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors.badge}`}>
                      {colors.label}
                    </span>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-kraft rounded text-xs font-mono-custom text-ledger-indigo/70">
                  "{c.typicalText}"
                </div>
                <div className="mt-2 text-xs text-ledger-indigo/60 leading-relaxed">
                  {c.consumerNote}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {c.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-ledger-paper border border-kraft rounded text-ledger-indigo/50">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-stamp-navy font-mono-custom font-semibold">
                    ✓ {c.confirmedCount} confirmed
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 text-[10px] text-ledger-indigo/30 text-center">
        Static seed data. Confirmed counts are illustrative — not from actual user voting.
      </div>
    </div>
  )
}