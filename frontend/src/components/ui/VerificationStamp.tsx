import { useRef } from 'react';
import { clsx } from 'clsx';

interface VerificationStampProps {
  taxonomyId: string;
  verified?: boolean;
  className?: string;
}

export function VerificationStamp({ taxonomyId, verified = true, className }: VerificationStampProps) {
  const rotation = useRef(Math.random() * 4 - 2);

  if (!verified) {
    return (
      <div
        className={clsx(
          'relative w-10 h-10 rounded-full border-2 border-dashed border-stamp-navy/50 flex items-center justify-center shrink-0',
          className
        )}
        title="Unverified - low confidence extraction"
      >
        <span className="text-[10px] font-mono text-stamp-navy/60">?</span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'relative w-10 h-10 flex items-center justify-center shrink-0',
        className
      )}
      style={{ transform: `rotate(${rotation.current}deg)` }}
      title={`${taxonomyId} · VERIFIED`}
      role="img"
      aria-label={`${taxonomyId} verified`}
    >
      {/* Serrated stamp ring */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke="#16283D"
          strokeWidth="1.5"
          strokeDasharray="2.5 1.5"
        />
        <circle
          cx="20"
          cy="20"
          r="15.5"
          stroke="#16283D"
          strokeWidth="0.5"
          opacity="0.4"
        />
      </svg>
      {/* Inner circle background */}
      <div className="w-7 h-7 rounded-full bg-stamp-navy/5 flex items-center justify-center">
        <span className="text-[7px] font-mono text-stamp-navy font-bold tracking-tight leading-none">
          {taxonomyId}
        </span>
      </div>
    </div>
  );
}