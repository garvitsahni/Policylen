const navItems = [
  { id: 'summary', label: 'Summary', icon: 'summarize' },
  { id: 'flags', label: 'Flags', icon: 'flag' },
  { id: 'scenarios', label: 'Scenarios', icon: 'psychology_alt' },
  { id: 'claims', label: 'Claims', icon: 'payments' },
]

export function SideNav({ active, onNavigate, onNewAnalysis }) {
  return (
    <nav className="flex flex-col h-full bg-secondary-fixed border-r border-primary p-6 space-y-6 offset-shadow-sm">
      <div>
        <div className="font-headline-md text-headline-md text-primary font-bold">PolicyLens AI</div>
        <div className="font-label-md text-label-md text-on-secondary-fixed-variant opacity-75 mt-1">Health Insurance Expert</div>
      </div>
      <div className="flex-grow space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg font-bold transition-all text-left ${
              active === item.id
                ? 'bg-primary text-on-primary'
                : 'text-on-secondary-fixed-variant hover:bg-surface-variant hover:translate-x-0.5'
            }`}
          >
            <span className="material-symbols-outlined w-5 flex items-center justify-center text-lg">{item.icon}</span>
            <span className="font-label-md text-label-md">{item.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onNewAnalysis}
        className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold flex items-center justify-center gap-2 offset-shadow-sm active:translate-y-0.5 active:shadow-none transition-all"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        <span className="text-sm">New Analysis</span>
      </button>
    </nav>
  )
}
