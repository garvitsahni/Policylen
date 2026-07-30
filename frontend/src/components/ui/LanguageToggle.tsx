import { useState, createContext, useContext, ReactNode } from 'react';
import { clsx } from 'clsx';

type Language = 'en' | 'hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (en: string, hi: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (en: string, hi: string) => (language === 'hi' ? hi : en);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t('Language', 'भाषा')}
      className="flex bg-surface-variant p-1 rounded-lg"
    >
      <button
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={clsx(
          'px-4 py-1.5 font-label-md text-label-md rounded-lg transition-all',
          language === 'en'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-on-surface-variant hover:bg-surface-container-high'
        )}
      >
        English
      </button>
      <button
        onClick={() => setLanguage('hi')}
        aria-pressed={language === 'hi'}
        className={clsx(
          'px-4 py-1.5 font-label-md text-label-md rounded-lg transition-all',
          language === 'hi'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-on-surface-variant hover:bg-surface-container-high'
        )}
      >
        हिंदी
      </button>
    </div>
  );
}
