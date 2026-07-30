import { useState, useRef } from 'react'
import { useLanguage } from './ui/LanguageToggle.jsx'

export function UploadZone({ onFileSelected, disabled }) {
  const { t } = useLanguage()
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError(t('Please select a PDF file.', '\u0915\u0943\u092a\u092f\u093e PDF \u092b\u093c\u093e\u0907\u0932 \u091a\u0941\u0928\u0947\u0902\u0964'))
      return
    }
    setError('')
    onFileSelected?.(file)
  }

  return (
    <div className="min-h-[calc(100vh-64px-80px)] flex items-center justify-center relative px-margin-desktop py-12">
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="grid grid-cols-12 h-full w-full max-w-container-max mx-auto px-margin-desktop gap-gutter">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-r border-primary h-full" />
          ))}
        </div>
      </div>
      <section className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-headline-lg text-headline-lg font-bold text-primary mb-2">Policy Clarity in Seconds.</h1>
          <p className="text-on-surface-variant text-body-lg text-body-lg">Upload your health insurance policy to reveal hidden flags and scenarios.</p>
        </div>
        <div className="group cursor-pointer relative" onClick={() => !disabled && inputRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }} role="button" tabIndex={0}>
          <div className="absolute inset-0 bg-primary translate-x-1.5 translate-y-1.5 rounded-lg" />
          <div className="relative bg-kraft border border-primary p-12 rounded-lg flex flex-col items-center justify-center text-center space-y-6 transition-transform hover:-translate-y-1 active:translate-y-0.5">
            <div className="w-20 h-20 bg-paper rounded-lg border border-primary flex items-center justify-center mb-2 shadow-sm">
              <span className="material-symbols-outlined text-4xl text-primary">upload_file</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-headline-md text-headline-md text-primary">{t('Drop your policy PDF', '\u0905\u092a\u0928\u0940 \u092a\u0949\u0932\u093f\u0938\u0940 PDF \u0921\u093e\u0932\u0947\u0902')}</h2>
              <p className="text-body-md text-body-md text-on-secondary-fixed-variant opacity-80">{t('or upload from your phone', '\u092f\u093e \u0905\u092a\u0928\u0947 \u092b\u093c\u094b\u0928 \u0938\u0947 \u0905\u092a\u0932\u094b\u0921 \u0915\u0930\u0947\u0902')}</p>
            </div>
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
            <button type="button" className="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md flex items-center gap-2 hover:bg-primary-container transition-colors">
              <span className="material-symbols-outlined text-lg">add</span>
              {t('SELECT DOCUMENT', '\u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c \u091a\u0941\u0928\u0947\u0902')}
            </button>
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center space-y-6">
          <div className="flex items-center gap-8 border-y border-outline-variant py-4 px-8 w-full justify-center opacity-70 grayscale">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl">policy</span>
              <span className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">IRDAI REGULATED</span>
            </div>
            <div className="h-4 w-px bg-outline-variant" />
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl">encrypted</span>
              <span className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">ISO 27001 SECURE</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">info</span>
            <p className="font-body-md text-body-md text-sm italic">&ldquo;{t('We never store your document without your permission.', '\u0939\u092e \u0906\u092a\u0915\u0940 \u0905\u0928\u0941\u092e\u0924\u093f \u0915\u0947 \u092c\u093f\u0928\u093e \u0906\u092a\u0915\u093e \u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c \u0938\u0902\u0917\u094d\u0930\u0939\u0940\u0924 \u0928\u0939\u0940\u0902 \u0915\u0930\u0924\u0947\u0964')}&rdquo;</p>
          </div>
        </div>
      </section>
    </div>
  )
}
