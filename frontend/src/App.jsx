import { useState, useCallback } from 'react'
import { LanguageProvider, LanguageToggle } from './components/ui/LanguageToggle.jsx'
import { SideNav } from './components/SideNav.jsx'
import { UploadZone } from './components/UploadZone.jsx'
import { ProcessingView } from './components/ProcessingView.jsx'
import { ScoreCard } from './components/ScoreCard.jsx'
import { FlagCardList } from './components/FlagCard.jsx'
import { ChatPanel } from './components/ChatPanel.jsx'
import { ScenarioSimulator } from './components/ScenarioSimulator.jsx'
import { ClaimsView } from './components/ClaimsView.jsx'
import { useIsMobile } from './lib/useMediaQuery.js'

function AppInner() {
  const [view, setView] = useState('upload')
  const [documentId, setDocumentId] = useState(null)
  const [flags, setFlags] = useState([])
  const [score, setScore] = useState(null)
  const [error, setError] = useState(null)
  const [activeNav, setActiveNav] = useState('flags')


  const handleNavigate = (nav) => {
    if (['summary', 'flags', 'scenarios', 'claims'].includes(nav)) {
      setActiveNav(nav)
    }
  }
  const _isMobile = useIsMobile()

  const handleFileSelected = useCallback(async (file) => {
    setView('processing')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/documents', { method: 'POST', body: formData })

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Upload failed')
      }

      const data = await uploadRes.json()
      setDocumentId(data.documentId)
      // ProcessingView polls GET /api/documents/:id/status and drives
      // onAnalyzed / onFailed as the real pipeline progresses.
    } catch (err) {
      console.error('Analysis failed:', err)
      setFlags([])
      setScore(null)
      setError(err.message || 'Analysis failed')
      setView('error')
    }
  }, [])

  const handleAnalysisComplete = useCallback((data) => {
    const backendFlags = (data.flags || []).map(f => ({
      ...f,
      colorType: f.colorType || 'red',
      confidence: f.confidence || 'high',
      pageNumber: f.pageNumber || null,
    }))
    setFlags(backendFlags)
    setScore(data.score ? {
      score: data.score.score,
      maxScore: data.score.maxScore || 100,
      flags: backendFlags,
      settlementRatio: data.score.settlementRatio || null,
    } : null)
    setView('results')
  }, [])

  const handleAnalysisFailed = useCallback((message) => {
    console.error('Analysis failed:', message)
    setFlags([])
    setScore(null)
    setError(message || 'Analysis failed')
    setView('error')
  }, [])

  const handleNewAnalysis = () => {
    setDocumentId(null)
    setFlags([])
    setScore(null)
    setError(null)
    setView('upload')
  }

  const headerContent = () => (
    <header className="bg-surface border-b border-primary w-full z-50">
      <div className="flex justify-between items-center w-full px-margin-desktop py-unit max-w-container-max mx-auto h-16">
        <div className="font-headline-md text-headline-md font-bold text-primary tracking-tight">PolicyLens</div>
        <div className="flex items-center gap-6">
          <LanguageToggle />
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-xl">verified_user</span>
            <span className="font-label-md text-label-md font-semibold">Secure Portal</span>
          </div>
        </div>
      </div>
    </header>
  )

  return (
    <div className="min-h-screen bg-paper">
      {view === 'upload' && headerContent()}
      {view === 'upload' && <UploadZone onFileSelected={handleFileSelected} />}
      {view === 'error' && (
        <div className="min-h-[calc(100vh-64px-80px)] flex items-center justify-center px-margin-desktop py-12">
          <section className="w-full max-w-lg bg-kraft border border-primary rounded-lg p-10 text-center">
            <span className="material-symbols-outlined text-5xl text-error">error</span>
            <h2 className="font-headline-lg text-headline-lg font-bold text-primary mt-4">Analysis Failed</h2>
            <p className="text-on-surface-variant mt-3">Your document could not be analyzed. This usually happens when the AI service is temporarily rate-limited or unreachable.</p>
            {error && <p className="font-mono text-sm text-error mt-3 break-words">{error}</p>}
            <button
              type="button"
              onClick={handleNewAnalysis}
              className="mt-8 bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors"
            >
              Try Again
            </button>
          </section>
        </div>
      )}
      {view === 'processing' && (
        <>
          {headerContent()}
          <ProcessingView
            documentId={documentId}
            onAnalyzed={handleAnalysisComplete}
            onFailed={handleAnalysisFailed}
          />
        </>
      )}
      {view === 'results' && (
        <div className="min-h-dvh flex flex-col lg:flex-row">
          <aside className="hidden lg:block w-[250px] shrink-0 sticky top-0 h-dvh self-start">
            <SideNav active={activeNav} onNavigate={handleNavigate} onNewAnalysis={handleNewAnalysis} />
          </aside>
          <main className="flex-1 min-w-0 flex flex-col p-6">
            <div className="flex-1 flex flex-col lg:flex-row gap-6 items-start">
              {score && (
                <div className="w-full lg:w-[260px] shrink-0">
                  <ScoreCard
                    score={score.score}
                    maxScore={score.maxScore}
                    settlementRatio={score.settlementRatio}
                    flagCount={flags.length}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 w-full">
                {activeNav === 'flags' && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-headline-md text-headline-md font-bold text-primary">Policy Flags</h2>
                      <span className="font-label-md text-label-md text-on-surface-variant shrink-0">{flags.length} Active Observations</span>
                    </div>
                    <FlagCardList flags={flags} />
                  </>
                )}
                {activeNav === 'scenarios' && <ScenarioSimulator documentId={documentId} />}
                {activeNav === 'claims' && <ClaimsView documentId={documentId} />}
                {activeNav === 'summary' && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-headline-md text-headline-md font-bold text-primary">Policy Summary</h2>
                    </div>
                    <div className="bg-kraft border border-primary rounded-xl p-6 space-y-4">
                      <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
                        Your health insurance policy has been analyzed. {flags.length} active observations were found.
                        The report card on the left shows the overall coverage score. Use the chat panel to ask questions
                        about specific clauses, or run scenarios to estimate out-of-pocket costs.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-outline-variant rounded-lg p-4">
                          <div className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest text-xs">Red Flags</div>
                          <div className="font-headline-md text-headline-md font-bold text-error mt-1">{flags.filter(f => f.colorType === 'red').length}</div>
                        </div>
                        <div className="bg-white border border-outline-variant rounded-lg p-4">
                          <div className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest text-xs">Green Flags</div>
                          <div className="font-headline-md text-headline-md font-bold text-primary mt-1">{flags.filter(f => f.colorType === 'green').length}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="w-full lg:w-[320px] shrink-0 sticky lg:top-6 self-start">
                <ChatPanel documentId={documentId} />
              </div>
            </div>
            <footer className="mt-12 bg-surface-container-low border-t border-primary">
              <div className="py-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <span className="font-label-md text-label-md text-primary font-bold">PolicyLens AI</span>
                  <p className="text-sm text-on-surface-variant mt-1">&copy; 2024 PolicyLens AI. IRDAI &amp; NPCI Certified.</p>
                </div>
                <div className="flex gap-6">
                  {['Privacy Policy', 'Terms of Service', 'Security Audit'].map(item => (
                    <a key={item} className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100 text-xs" href="#">{item}</a>
                  ))}
                </div>
              </div>
            </footer>
          </main>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  )
}

export default App
