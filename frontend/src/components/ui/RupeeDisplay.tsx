import { clsx } from 'clsx';
import { formatINR } from '@/lib/rupee';

interface RupeeDisplayProps {
  amount: number | null | undefined;
  className?: string;
  fallback?: string;
  color?: 'inherit' | 'sindoor' | 'turmeric' | 'neem' | 'ledger-indigo';
}

export function RupeeDisplay({ amount, className, fallback = 'Not stated in policy', color = 'inherit' }: RupeeDisplayProps) {
  if (amount === null || amount === undefined) {
    return (
      <span className={clsx('text-ledger-indigo/50 italic text-sm font-mono', className)}>
        {fallback}
      </span>
    );
  }

  const colorClasses = {
    inherit: 'text-inherit',
    sindoor: 'text-sindoor',
    turmeric: 'text-turmeric',
    neem: 'text-neem',
    'ledger-indigo': 'text-ledger-indigo',
  };

  return (
    <span
      className={clsx(
        'font-mono tabular-nums font-medium',
        colorClasses[color],
        className
      )}
    >
      {formatINR(amount)}
    </span>
  );
}