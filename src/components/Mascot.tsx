type Mood = 'sad' | 'neutral' | 'happy' | 'fire';

function moodFromStreak(streak: number): Mood {
  if (streak === 0) return 'sad';
  if (streak < 3) return 'neutral';
  if (streak < 30) return 'happy';
  return 'fire';
}

export const Mascot: React.FC<{ streak: number; size?: number; className?: string }> = ({
  streak, size = 96, className,
}) => {
  const mood = moodFromStreak(streak);
  // Нейтральные настроения — светлое тело с бордером (не тёмное пятно);
  // цветные (happy/fire) — тёмные черты лица на насыщенной заливке.
  const isNeutral = mood === 'neutral' || mood === 'sad';
  const body = mood === 'fire' ? '#f97316' : mood === 'happy' ? 'var(--accent)' : 'var(--bg-hover)';
  const face = isNeutral ? 'var(--text-muted)' : 'rgba(0,0,0,0.78)';
  const eyeY = mood === 'sad' ? 50 : mood === 'fire' ? 42 : 46;
  const mouthPath = mood === 'sad' ? 'M 38 70 Q 50 60 62 70'
                  : mood === 'neutral' ? 'M 38 68 L 62 68'
                  : mood === 'fire' ? 'M 36 64 Q 50 78 64 64'
                  : 'M 36 64 Q 50 76 64 64';
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      className={className} aria-label="mascot"
    >
      {/* fire aura */}
      {mood === 'fire' && (
        <g style={{ animation: 'fade-in 600ms ease-out' }}>
          <path d="M 50 4 C 38 18 30 28 30 42 C 30 52 40 60 50 60 C 60 60 70 52 70 42 C 70 28 62 18 50 4 Z"
            fill="#ef4444" opacity="0.25" />
          <path d="M 50 12 C 42 22 36 30 36 42 C 36 50 43 56 50 56 C 57 56 64 50 64 42 C 64 30 58 22 50 12 Z"
            fill="#fbbf24" opacity="0.45" />
        </g>
      )}
      {/* body — rounded square */}
      <rect x="20" y="28" width="60" height="58" rx="14" ry="14" fill={body} stroke={isNeutral ? 'var(--border)' : 'none'} strokeWidth="2" />
      {/* eyes */}
      <circle cx="38" cy={eyeY} r="4" fill={face} />
      <circle cx="62" cy={eyeY} r="4" fill={face} />
      {mood !== 'sad' && !isNeutral && (
        <>
          <circle cx="39" cy={eyeY - 1} r="1.2" fill="#fff" />
          <circle cx="63" cy={eyeY - 1} r="1.2" fill="#fff" />
        </>
      )}
      {/* mouth */}
      <path d={mouthPath} stroke={face} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* streak badge — огненный чип, одинаково хорош в обеих темах */}
      {streak > 0 && (
        <g>
          <rect x="62" y="6" width="32" height="22" rx="11" fill="#f97316" />
          <text x="78" y="22" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#fff">
            🔥{streak}
          </text>
        </g>
      )}
    </svg>
  );
};
