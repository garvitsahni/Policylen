import { clsx } from 'clsx';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'green';

const severityStyles: Record<Severity, string> = {
  critical: 'bg-sindoor text-ledger-paper',
  high: 'bg-sindoor/90 text-ledger-paper',
  medium: 'bg-turmeric text-ledger-paper',
  low: 'bg-turmeric/80 text-ledger-paper',
  green: 'bg-neem text-ledger-paper',
};

const severityLabels: Record<Severity, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  green: 'FAVORABLE',
};

const severityIcons: Record<Severity, string> = {
  critical: '⬤',
  high: '▲',
  medium: '■',
  low: '◆',
  green: '✓',
};

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
  showLabel?: boolean;
}

export function SeverityBadge({ severity, className, showLabel = true }: SeverityBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        severityStyles[severity],
        className
      )}
      aria-label={`Severity: ${severityLabels[severity]}`}
    >
      <span aria-hidden="true">{severityIcons[severity]}</span>
      {showLabel && <span>{severityLabels[severity]}</span>}
    </span>
  );
}