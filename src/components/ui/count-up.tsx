import { useEffect, useRef, useState } from 'react';

/** Плавно докручивает число до value (ease-out cubic, rAF).
 *  Уважает prefers-reduced-motion — тогда значение ставится мгновенно. */
export const CountUp: React.FC<{ value: number; duration?: number; suffix?: string; className?: string; style?: React.CSSProperties }> = ({ value, duration = 600, suffix = '', className, style }) => {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      prev.current = value;
      setDisplay(value);
      return;
    }
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className} style={style}>{display}{suffix}</span>;
};
