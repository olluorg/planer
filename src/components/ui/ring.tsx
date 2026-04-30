import * as React from 'react';

interface RingProps {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  glow?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const Ring: React.FC<RingProps> = ({
  value,
  size = 120,
  stroke = 10,
  color = 'var(--accent)',
  trackColor = 'rgba(255,255,255,0.06)',
  glow = true,
  children,
  className,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const offset = c - (v / 100) * c;
  const isAccent = color === 'var(--accent)' || color === '#84CC16';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" style={{ overflow: 'visible' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={trackColor} strokeWidth={stroke} fill="none"
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 600ms cubic-bezier(0.4,0,0.2,1)',
            filter: glow && isAccent && v > 0
              ? 'drop-shadow(0 0 6px rgba(132,204,22,0.6)) drop-shadow(0 0 14px rgba(132,204,22,0.3))'
              : undefined,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};
