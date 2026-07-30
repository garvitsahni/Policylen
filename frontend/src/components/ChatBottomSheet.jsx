import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from './ui/LanguageToggle.jsx'
import { ChatPanel } from './ChatPanel.jsx'

export function ChatBottomSheet({ documentId }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* FAB */}
      <motion.button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-ledger-indigo text-ledger-paper shadow-lg flex items-center justify-center z-40 focus-visible:ring-2 focus-visible:ring-ledger-indigo focus-visible:ring-offset-2 focus-visible:outline-none"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.92 }}
        aria-label={t('Ask about your policy', 'अपनी पॉलिसी के बारे में पूछें')}
      >
        <span className="text-xl">💬</span>
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="bg-ledger-paper rounded-t-2xl shadow-xl max-h-[80vh] flex flex-col">
              {/* Handle */}
              <div className="shrink-0 flex items-center justify-between p-4 border-b border-kraft">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neem/60 animate-pulse" />
                  <span className="font-serif-custom text-base">{t('Ask PolicyLens', 'PolicyLens से पूछें')}</span>
                </div>
                <button
                  className="w-8 h-8 rounded-full bg-kraft/50 flex items-center justify-center text-ledger-indigo/60 hover:bg-kraft transition-colors"
                  onClick={() => setOpen(false)}
                  aria-label={t('Close chat', 'चैट बंद करें')}
                >
                  ✕
                </button>
              </div>
              {/* Pull handle indicator */}
              <div className="shrink-0 flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-kraft" />
              </div>
              {/* Chat content */}
              <div className="flex-1 overflow-hidden">
                <ChatPanel documentId={documentId} embedded />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
