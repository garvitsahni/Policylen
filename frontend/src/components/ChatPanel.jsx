import { useState, useRef, useEffect } from 'react'
import { useLanguage } from './ui/LanguageToggle.jsx'

export function ChatPanel({ documentId }) {
  const { t } = useLanguage()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: t('Hello! I\'ve scanned your policy. What specific coverage details can I clarify for you?', '\u0928\u092e\u0938\u094d\u0924\u0947! \u092e\u0948\u0902\u0928\u0947 \u0906\u092a\u0915\u0940 \u092a\u0949\u0932\u093f\u0938\u0940 \u0938\u094d\u0915\u0948\u0928 \u0915\u0930 \u0932\u0940 \u0939\u0948\u0964 \u092e\u0948\u0902 \u0906\u092a\u0915\u094b \u0915\u0948\u0938\u0947 \u092e\u0926\u0926 \u0915\u0930 \u0938\u0915\u0924\u093e \u0939\u0942\u0902?') },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const q = input.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', content: q }])
    setLoading(true)
    setMessages(m => [...m, { role: 'assistant', content: '...' }])
    try {
      const res = await fetch(`/api/chat/${documentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history: messages.slice(-6) }),
      })
      if (!res.ok) throw new Error('Chat failed')
      const data = await res.json()
      setMessages(m => [...m.slice(0, -1), { role: 'assistant', content: data.answer || data.response || 'No answer available.' }])
    } catch {
      setMessages(m => [...m.slice(0, -1), { role: 'assistant', content: t('Not covered in this document.', '\u0907\u0938 \u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c \u092e\u0947\u0902 \u0936\u093e\u092e\u093f\u0932 \u0928\u0939\u1960\u0902 \u0939\u0948\u0964') }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-container-high rounded-xl border border-outline flex flex-col shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
      <div className="p-4 border-b border-outline-variant bg-primary text-on-primary rounded-t-xl">
        <div className="font-label-md text-label-md font-semibold">PolicyLens Assistant</div>
        <div className="text-xs opacity-80">{t('Ask about your policy', '\u0905\u092a\u0928\u0940 \u092a\u0949\u0932\u093f\u0938\u0940 \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902 \u092a\u0942\u091b\u0947\u0902')}</div>
      </div>
      <div className="flex-grow p-4 space-y-3 overflow-y-auto max-h-[400px] ledger-line min-h-[260px]">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg border text-sm max-w-[85%] ${
              m.role === 'user'
                ? 'bg-primary/10 border-primary/20 shadow-sm ml-auto'
                : 'bg-white border-outline-variant shadow-sm'
            }`}
          >
            {m.content === '...' ? (
              <span className="animate-pulse">Thinking</span>
            ) : (
              m.content
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 bg-white border-t border-outline-variant rounded-b-xl">
        <div className="relative">
          <input
            className="w-full bg-surface border border-outline rounded-lg py-2.5 px-4 pr-12 focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm"
            placeholder={t('Type your question\u2026', '\u0905\u092a\u0928\u093e \u092a\u094d\u0930\u0936\u094d\u0928 \u0932\u093f\u0916\u0947\u0902\u2026')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            disabled={loading}
          />
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary disabled:opacity-40"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  )
}
