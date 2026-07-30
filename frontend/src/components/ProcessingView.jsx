import { useEffect, useState } from 'react'

const steps = [
  { en: 'Reading your document\u2026', hi: '\u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c \u092a\u0922\u093c \u0930\u0939\u0947 \u0939\u0948\u0902\u2026' },
  { en: 'Matching clauses\u2026', hi: '\u0928\u093f\u092f\u092e\u094b\u0902 \u0915\u093e \u092e\u093f\u0932\u093e\u0928 \u0915\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902\u2026' },
  { en: 'Calculating your risk\u2026', hi: '\u091c\u094b\u0916\u093f\u092e \u0915\u0940 \u0917\u0923\u0928\u093e \u0939\u094b \u0930\u0939\u0940 \u0939\u0948\u2026' },
]

export function ProcessingView() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= steps.length - 1) return
    const timer = setTimeout(() => setStep(s => s + 1), 2500)
    return () => clearTimeout(timer)
  }, [step])

  return (
    <main className="min-h-[calc(100vh-64px-80px)] flex items-center justify-center relative px-margin-desktop py-12">
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="grid grid-cols-12 h-full w-full max-w-container-max mx-auto px-margin-desktop gap-gutter">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-r border-primary h-full" />
          ))}
        </div>
      </div>
      <section className="w-full max-w-container-max mx-auto">
        <div className="flex gap-gutter">
          <aside className="w-64 h-[600px] bg-secondary-fixed opacity-50 rounded-lg flex flex-col p-4 space-y-6 shimmer">
            <div className="h-8 w-3/4 bg-on-secondary-fixed-variant/10 rounded" />
            <div className="space-y-4 pt-10">
              <div className="h-10 w-full bg-on-secondary-fixed-variant/5 rounded" />
              <div className="h-10 w-full bg-on-secondary-fixed-variant/5 rounded" />
              <div className="h-10 w-full bg-on-secondary-fixed-variant/5 rounded" />
              <div className="h-10 w-full bg-on-secondary-fixed-variant/5 rounded" />
            </div>
          </aside>
          <div className="flex-1 flex flex-col gap-gutter">
            <div className="h-32 w-full bg-kraft border border-primary/20 rounded-lg flex items-center justify-between px-8 shimmer">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-primary/10 rounded" />
                <div className="h-8 w-64 bg-primary/10 rounded" />
              </div>
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/5 border border-primary/10" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-gutter h-[450px]">
              <div className="col-span-2 bg-paper border border-primary/20 rounded-lg p-6 shimmer">
                <div className="h-6 w-1/4 bg-primary/10 rounded mb-6" />
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i}>
                      <div className="h-px w-full bg-outline-variant/30" />
                      <div className="flex justify-between items-center py-2">
                        <div className={`h-4 bg-primary/5 rounded ${i === 1 ? 'w-1/3' : i === 2 ? 'w-1/2' : 'w-1/4'}`} />
                        <div className={`h-4 bg-primary/5 rounded ${i === 1 ? 'w-1/4' : i === 2 ? 'w-1/6' : 'w-1/2'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-1 bg-kraft/40 border border-primary/20 rounded-lg p-6 shimmer">
                <div className="h-6 w-1/2 bg-primary/10 rounded mb-6" />
                <div className="space-y-4">
                  <div className="h-24 w-full bg-paper/50 rounded-lg border border-primary/10" />
                  <div className="h-24 w-full bg-paper/50 rounded-lg border border-primary/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-primary text-on-primary px-12 py-6 rounded-xl border-4 border-kraft shadow-xl flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <svg className="animate-spin h-6 w-6 text-kraft" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
              </svg>
              <span className="font-headline-md text-headline-md tracking-wide">{steps[step].en}</span>
            </div>
            <div className="font-body-md text-body-md opacity-70">{steps[step].hi}</div>
          </div>
        </div>
      </section>
    </main>
  )
}
