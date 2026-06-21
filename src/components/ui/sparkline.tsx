interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
}

/** Лёгкий SVG-спарклайн без зависимостей. */
export const Sparkline: React.FC<Props> = ({
  data,
  width = 96,
  height = 32,
  color = 'var(--accent)',
  fill = true,
  strokeWidth = 2,
  className,
}) => {
  if (data.length === 0) {
    return <svg width={width} height={height} className={className} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const n = data.length;
  const pad = strokeWidth;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = pad + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  // Гладкая кривая через Catmull-Rom → cubic Bézier (вместо ломаной полилинии)
  let line = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const area = `${line} L ${points[n - 1][0].toFixed(1)} ${height} L ${points[0][0].toFixed(1)} ${height} Z`;
  const gid = `spark-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {/* последняя точка */}
      <circle cx={points[n - 1][0]} cy={points[n - 1][1]} r={strokeWidth + 0.5} fill={color} />
    </svg>
  );
};
