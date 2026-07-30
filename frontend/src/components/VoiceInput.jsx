import { useState, useRef } from 'react'

const LANGUAGES = [
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'te', name: 'Telugu' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'gu', name: 'Gujarati' },
]

export function VoiceInput({ onTranslated }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [targetLang, setTargetLang] = useState('hi')
  const [translating, setTranslating] = useState(false)
  const [translation, setTranslation] = useState('')
  const recognitionRef = useRef(null)

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setTranscript('Voice input not supported in this browser. Try Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('')
      setTranscript(text)
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    setListening(true)
    recognition.start()
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
    }
  }

  const doTranslate = async () => {
    if (!transcript.trim()) return
    setTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript, targetLang }),
      })
      const data = await res.json()
      if (data.translation) {
        setTranslation(data.translation)
        if (onTranslated) onTranslated(data.translation)
      } else if (data.detail) {
        setTranslation(`[${data.detail}]`)
      }
    } catch {
      setTranslation('Translation failed. Try again.')
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="bg-kraft rounded-lg p-4 border border-ledger-indigo/20">
      <div className="font-serif-custom text-base mb-1">Voice Input & Translation</div>
      <p className="text-xs text-ledger-indigo/50 mb-3">Speak in English, get output in your language.</p>

      <div className="flex gap-2 mb-3">
        <button
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            listening
              ? 'bg-sindoor text-white animate-pulse'
              : 'bg-ledger-indigo text-ledger-paper hover:bg-ledger-indigo/90'
          }`}
          onClick={listening ? stopListening : startListening}
        >
          {listening ? '🔴 Listening...' : '🎤 Speak'}
        </button>
        <select
          className="px-3 py-2 border border-ledger-indigo/20 rounded-lg text-sm bg-white"
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </div>

      {transcript && (
        <div className="space-y-2">
          <div className="p-2 bg-white rounded border border-ledger-indigo/10 text-sm">
            <span className="text-xs font-semibold text-ledger-indigo/50">You said:</span>
            <p className="mt-0.5">{transcript}</p>
          </div>

          <button
            className="w-full px-3 py-1.5 bg-ledger-indigo text-white rounded-lg text-sm font-medium hover:bg-ledger-indigo/90 transition-colors disabled:opacity-50"
            onClick={doTranslate}
            disabled={translating}
          >
            {translating ? 'Translating...' : `Translate to ${LANGUAGES.find(l => l.code === targetLang)?.name || targetLang}`}
          </button>

          {translation && (
            <div className="p-2 bg-neem/5 border border-neem/20 rounded text-sm">
              <span className="text-xs font-semibold text-neem">Translation:</span>
              <p className="mt-0.5 text-neem/80">{translation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}