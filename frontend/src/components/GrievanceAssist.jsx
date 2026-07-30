import { useState } from 'react'

export function GrievanceAssist({ documentId }) {
  const [claimantName, setClaimantName] = useState('')
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState(null)
  const [copied, setCopied] = useState(false)

  const REASON_OPTIONS = [
    'Claim rejected citing pre-existing condition waiting period',
    'Claim rejected citing permanent exclusion',
    'Claim delayed beyond 30 days',
    'Reimbursement amount less than expected / proportionate deduction applied',
    'Cashless request denied by insurer',
    'Sub-limit applied on procedure',
  ]

  const generateDraft = async () => {
    if (!claimantName.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/grievance-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          claimantName: claimantName.trim(),
          reason: reason || 'Claim not processed as expected',
          amount: amount ? parseInt(amount.replace(/[^0-9]/g, '')) : null,
          date: date || null,
        }),
      })
      const data = await res.json()
      if (data.success) setDraft(data)
    } catch {
      setDraft({ error: 'Failed to generate draft' })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (!draft?.body) return
    const text = `Subject: ${draft.subject}\n\n${draft.body}`
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-ledger-paper border border-kraft rounded-lg p-5">
      <div className="font-serif-custom text-lg mb-1">Grievance Filing Assist</div>
      <p className="text-xs text-ledger-indigo/50 mb-4">Generate an editable complaint draft. Always review before sending.</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-ledger-indigo/60">Your Name *</label>
          <input
            className="w-full mt-1 px-3 py-2 border border-kraft rounded-lg text-sm"
            placeholder="e.g. Ravi Sharma"
            value={claimantName}
            onChange={(e) => setClaimantName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-ledger-indigo/60">Reason for Grievance</label>
          <div className="flex flex-wrap gap-1.5 mt-1 mb-1">
            {REASON_OPTIONS.map(r => (
              <button
                key={r}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  reason === r
                    ? 'bg-ledger-indigo text-white border-ledger-indigo'
                    : 'bg-kraft border-ledger-indigo/20 hover:bg-ledger-indigo/10'
                }`}
                onClick={() => setReason(r)}
              >
                {r.slice(0, 45)}...
              </button>
            ))}
          </div>
          <textarea
            className="w-full px-3 py-2 border border-kraft rounded-lg text-sm resize-y min-h-[50px]"
            placeholder="Or describe in your own words..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ledger-indigo/60">Claim Amount (₹)</label>
            <input
              className="w-full mt-1 px-3 py-2 border border-kraft rounded-lg text-sm"
              placeholder="e.g. 150000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ledger-indigo/60">Date</label>
            <input
              className="w-full mt-1 px-3 py-2 border border-kraft rounded-lg text-sm"
              placeholder="e.g. 15/06/2025"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <button
          className="w-full px-4 py-2 bg-stamp-navy text-white rounded-lg text-sm font-medium hover:bg-stamp-navy/90 transition-colors disabled:opacity-50"
          onClick={generateDraft}
          disabled={loading || !claimantName.trim()}
        >
          {loading ? 'Generating...' : 'Generate Grievance Draft'}
        </button>
      </div>

      {draft && draft.body && (
        <div className="mt-5 space-y-3">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
            ⚠️ {draft.warning || 'This is an editable draft. PolicyLens does not send or file grievances.'}
          </div>

          <div className="p-3 bg-white border border-kraft rounded-lg">
            <div className="text-xs font-semibold text-ledger-indigo/60 mb-1">Subject</div>
            <div className="text-sm font-medium">{draft.subject}</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-ledger-indigo/60">Draft Body</div>
              <div className="flex gap-2">
                <button
                  className="text-xs px-2 py-1 bg-kraft rounded hover:bg-ledger-indigo/10 transition-colors"
                  onClick={copyToClipboard}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <textarea
              className="w-full border border-kraft rounded-lg p-3 text-sm font-mono-custom resize-y min-h-[250px] leading-relaxed"
              defaultValue={draft.body}
              readOnly={false}
            />
          </div>

          <div className="text-xs text-ledger-indigo/30 text-center pt-2">
            This draft is yours. Edit, save, and send at your discretion. Not filed by PolicyLens.
          </div>
        </div>
      )}
    </div>
  )
}