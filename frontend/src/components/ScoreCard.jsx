export function ScoreCard({ score, maxScore = 100, settlementRatio, flagCount }) {
  const pct = score / maxScore
  const strength = score >= 80 ? 'Low Risk' : score >= 50 ? 'Moderate Risk' : 'High Risk'
  const strengthBg = score >= 80 ? 'bg-neem' : score >= 50 ? 'bg-amber-600' : 'bg-error'

  return (
    <div className="bg-kraft p-6 rounded-xl border border-primary offset-shadow">
      <h2 className="font-label-md text-label-md uppercase mb-4 text-primary font-semibold tracking-wider">Policy Health Score</h2>
      <div className="flex flex-col items-center">
        <div className="relative w-28 h-28 flex items-center justify-center mb-3">
          <svg className="w-full h-full -rotate-90">
            <circle className="text-white/30" cx="56" cy="56" fill="transparent" r="50" stroke="currentColor" strokeWidth="7" />
            <circle
              className="text-primary"
              cx="56" cy="56"
              fill="transparent" r="50"
              stroke="currentColor"
              strokeDasharray={314.16}
              strokeDashoffset={314.16 * (1 - pct)}
              strokeWidth="10"
            />
          </svg>
          <span className="absolute font-display-lg text-display-lg text-primary">{score}</span>
        </div>
        <div className="text-center">
          <span className={`${strengthBg} text-white font-bold px-3 py-1 rounded text-sm inline-block`}>{strength}</span>
          <p className="font-body-md text-body-md text-on-secondary-fixed-variant underline cursor-pointer mt-2">see how this is calculated</p>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-primary/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded shrink-0">
            <span className="material-symbols-outlined text-primary block" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
          <div>
            <p className="font-label-md text-label-md text-primary font-semibold">Settlement Ratio</p>
            <p className="font-figure-mono text-figure-mono text-primary">{settlementRatio || 'N/A'}% (IRDAI)</p>
          </div>
        </div>
        {flagCount > 0 && (
          <div className="bg-white/50 border border-primary/10 p-4 rounded-lg text-xs leading-relaxed text-on-secondary-fixed-variant italic shadow-sm">
            {flagCount} active observation{flagCount > 1 ? 's' : ''} found in this policy.
          </div>
        )}
      </div>
    </div>
  )
}
