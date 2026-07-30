import { useState, useCallback } from 'react'
import { LanguageProvider, LanguageToggle } from './components/ui/LanguageToggle.jsx'
import { SideNav } from './components/SideNav.jsx'
import { UploadZone } from './components/UploadZone.jsx'
import { ProcessingView } from './components/ProcessingView.jsx'
import { ScoreCard } from './components/ScoreCard.jsx'
import { FlagCardList } from './components/FlagCard.jsx'
import { ChatPanel } from './components/ChatPanel.jsx'
import { ScenarioSimulator } from './components/ScenarioSimulator.jsx'
import { useIsMobile } from './lib/useMediaQuery.js'

function AppInner() {
  const [view, setView] = useState('upload')
  const [documentId, setDocumentId] = useState(null)
  const [flags, setFlags] = useState([])
  const [score, setScore] = useState(null)
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

      setTimeout(() => setView('results'), 1000)
    } catch (err) {
      console.error('Analysis failed:', err)
      setFlags([])
      setScore(null)
      setView('results')
    }
  }, [])

  const handleNewAnalysis = () => {
    setDocumentId(null)
    setFlags([])
    setScore(null)
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
      {view === 'processing' && (
        <>
          {headerContent()}
          <ProcessingView />
        </>
      )}
      {view === 'results' && (
        <div className="min-h-dvh flex flex-col lg:flex-row">
          <aside className="hidden lg:block w-[250px] shrink-0 sticky top-0 h-dvh self-start">
            <SideNav active="flags" onNewAnalysis={handleNewAnalysis} />
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
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-headline-md text-headline-md font-bold text-primary">Policy Flags</h2>
                  <span className="font-label-md text-label-md text-on-surface-variant shrink-0">{flags.length} Active Observations</span>
                </div>
                <FlagCardList flags={flags} />
              </div>
              <div className="w-full lg:w-[320px] shrink-0 sticky lg:top-6 self-start">
                <ChatPanel documentId={documentId} />
              </div>
            </div>
            <div className="mt-12">
              <ScenarioSimulator documentId={documentId} />
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
