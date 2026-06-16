import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Общее',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Командная палитра / поиск' },
      { keys: ['Ctrl', 'I'], label: 'Панель инсайтов' },
      { keys: ['Ctrl', 'Shift', 'F'], label: 'Focus Mode (Deep Work)' },
      { keys: ['?'], label: 'Показать эту шпаргалку' },
      { keys: ['Esc'], label: 'Закрыть оверлей' },
    ],
  },
  {
    title: 'Быстрое добавление',
    items: [
      { keys: ['T'], label: 'Новая задача (в палитре)' },
      { keys: ['H'], label: 'Новая привычка (в палитре)' },
      { keys: ['G'], label: 'Новая цель (в палитре)' },
      { keys: ['P'], label: 'Записать показатель (в палитре)' },
    ],
  },
  {
    title: 'Focus Mode',
    items: [
      { keys: ['Space'], label: 'Старт / пауза' },
      { keys: ['Esc'], label: 'Выйти' },
    ],
  },
];

export const ShortcutsHelp: React.FC<Props> = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Горячие клавиши</DialogTitle>
      </DialogHeader>
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="text-label text-text-muted mb-2">{g.title}</div>
            <div className="space-y-1.5">
              {g.items.map((it) => (
                <div key={it.label} className="flex items-center justify-between text-sm">
                  <span className="text-text">{it.label}</span>
                  <div className="flex items-center gap-1">
                    {it.keys.map((k) => (
                      <kbd key={k} className="px-1.5 py-0.5 rounded-md bg-bg-soft border border-border-soft text-[11px] text-text-muted font-mono">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
