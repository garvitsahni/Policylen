import { useState } from 'react'
import { GrievanceAssist } from './GrievanceAssist.jsx'

export function ClaimsView({ documentId }) {
  const [tab, setTab] = useState('grievance')

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-headline-lg text-headline-lg text-primary font-bold">Claims & Grievances</h2>
        <p className="font-body-md text-body-md text-on-secondary-fixed-variant mt-1">
          Understand what your policy covers, and prepare a compliant grievance if a claim goes wrong.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('grievance')}
          className={`px-4 py-2 rounded-lg font-label-md text-label-md border transition-colors ${
            tab === 'grievance'
              ? 'bg-primary text-on-primary border-primary'
              : 'bg-white text-primary border-primary hover:bg-surface-variant'
          }`}
        >
          Grievance Assist
        </button>
      </div>

      {tab === 'grievance' && <GrievanceAssist documentId={documentId} />}
    </div>
  )
}
