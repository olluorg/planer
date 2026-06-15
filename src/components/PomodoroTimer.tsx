import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Pause, Play, Square, RotateCcw } from 'lucide-react';
import { Ring } from './ui/ring';
import { useStore } from '@/lib/store';
import { usePomodoroState } from '@/lib/pomodoroState';
import type { Task } from '@/lib/types';

const PRESETS = [
  { label: 'Помодоро 25', work: 25, rest: 5 },
  { label: 'Длинный 50', work: 50, rest: 10 },
  { label: 'Короткий 15', work: 15, rest: 3 },
];

export const PomodoroTimer: React.FC<{
  task: Task | null;
  open?: boolean;
  onClose: () => void;
}> = ({ task, open: openProp, onClose }) => {
  const open = openProp ?? task !== null;
  const startTimeEntry = useStore((s) => s.startTimeEntry);
  const finishTimeEntry = useStore((s) => s.finishTimeEntry);
  const setGlobal = usePomodoroState((s) => s.set);

  const [preset, setPreset] = useState(PRESETS[0]);
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [secondsLeft, setSecondsLeft] = useState(preset.work * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setGlobal({
      running,
      phase,
      secondsLeft,
      taskTitle: task?.title ?? null,
    });
  }, [running, phase, secondsLeft, task?.title, setGlobal]);

  useEffect(() => () => {
    setGlobal({ running: false, secondsLeft: 0, taskTitle: null, pauseAction: null, resumeAction: null, stopAction: null });
  }, [setGlobal]);

  // expose pause/resume/stop actions to global state for Topbar inline control
  useEffect(() => {
    setGlobal({
      pauseAction: () => setRunning(false),
      resumeAction: () => {
        if (!entryIdRef.current && phase === 'work') {
          const e = startTimeEntry(task?.id ?? null, 'pomodoro');
          entryIdRef.current = e.id;
          elapsedRef.current = 0;
        }
        setRunning(true);
      },
      stopAction: () => {
        setRunning(false);
        if (entryIdRef.current) {
          finishTimeEntry(entryIdRef.current, elapsedRef.current);
          entryIdRef.current = null;
        }
        elapsedRef.current = 0;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, task?.id]);
  const tickRef = useRef<number | null>(null);
  const entryIdRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  const total = (phase === 'work' ? preset.work : preset.rest) * 60;
  const pct = total ? Math.round(((total - secondsLeft) / total) * 100) : 0;

  useEffect(() => {
    if (open) reset(preset); else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          phaseEnd();
          return 0;
        }
        elapsedRef.current += 1;
        return s - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  const phaseEnd = () => {
    if (phase === 'work') {
      // finish entry, go to rest
      if (entryIdRef.current) {
        finishTimeEntry(entryIdRef.current, elapsedRef.current);
        entryIdRef.current = null;
      }
      try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play().catch(() => {}); } catch {}
      setPhase('rest');
      setSecondsLeft(preset.rest * 60);
      elapsedRef.current = 0;
    } else {
      stop();
    }
  };

  const start = () => {
    if (!entryIdRef.current && phase === 'work') {
      const e = startTimeEntry(task?.id ?? null, 'pomodoro');
      entryIdRef.current = e.id;
      elapsedRef.current = 0;
    }
    setRunning(true);
  };

  const pause = () => setRunning(false);

  const stop = () => {
    setRunning(false);
    if (entryIdRef.current) {
      finishTimeEntry(entryIdRef.current, elapsedRef.current);
      entryIdRef.current = null;
    }
    elapsedRef.current = 0;
  };

  const reset = (p = preset) => {
    stop();
    setPreset(p);
    setPhase('work');
    setSecondsLeft(p.work * 60);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && (stop(), onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task?.title ?? 'Свободный таймер'}</DialogTitle>
          <div className="text-xs text-text-muted">{phase === 'work' ? 'Работа' : 'Отдых'}</div>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <Ring value={pct} size={180} stroke={12} color={phase === 'work' ? '#22c55e' : '#3b82f6'}>
            <div className="text-3xl font-semibold tabular-nums">{fmt(secondsLeft)}</div>
          </Ring>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} variant={p.label === preset.label ? 'default' : 'soft'} size="sm" onClick={() => reset(p)}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter>
          {!running ? (
            <Button onClick={start}><Play /> Старт</Button>
          ) : (
            <Button variant="soft" onClick={pause}><Pause /> Пауза</Button>
          )}
          <Button variant="ghost" onClick={() => reset()}><RotateCcw /> Сброс</Button>
          <Button variant="danger" onClick={() => { stop(); onClose(); }}><Square /> Завершить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
