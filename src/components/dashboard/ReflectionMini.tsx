import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const MOODS = ['😞', '😕', '😐', '🙂', '😊'];

export const ReflectionMini: React.FC<{ date: Date }> = ({ date }) => {
  const today = isoDate(date);
  const { reflections, upsertReflection } = useStore();
  const cur = reflections.find((r) => r.date === today);
  const [mood, setMood] = useState<number | null>(cur?.mood ?? null);
  const [note, setNote] = useState(cur?.note ?? '');

  useEffect(() => { setMood(cur?.mood ?? null); setNote(cur?.note ?? ''); }, [today]);

  const filled = mood !== null;

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text">Рефлексия дня</h3>
        <Button variant="ghost" size="sm" onClick={() => upsertReflection({ date: today, mood, note })}>
          {filled ? 'Сохранить' : 'Заполнить'}
        </Button>
      </div>
      <div className="text-xs text-text-muted mb-2">Как прошёл твой день?</div>
      <div className="flex gap-2 mb-3">
        {MOODS.map((e, i) => (
          <button
            key={i}
            onClick={() => setMood(i)}
            className={`h-9 w-9 rounded-xl text-lg transition-all ${mood === i ? 'bg-accent/15 ring-2 ring-accent scale-110' : 'bg-bg-soft hover:bg-bg-hover'}`}
          >{e}</button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Заметка о дне..."
        className="w-full h-16 rounded-lg border border-border-soft bg-bg-soft px-3 py-2 text-xs text-text resize-none outline-none focus:border-accent transition-colors"
      />
    </div>
  );
};
