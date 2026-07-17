import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useScreens, SCREEN_TEMPLATES } from '@/lib/screens';

/** Переключатель экранов дашборда (как рабочие столы). Переименование/удаление — у активного. */
export const ScreenTabs: React.FC = () => {
  const { screens, activeId, setActive, add, rename, remove } = useScreens();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState('blank');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const submitAdd = () => { add(name, tpl); setAddOpen(false); setName(''); setTpl('blank'); };
  const startRename = (id: string, current: string) => { setEditingId(id); setDraft(current); };
  const commitRename = () => { if (editingId) rename(editingId, draft); setEditingId(null); };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {screens.map((s) => {
        const isActive = s.id === activeId;
        if (editingId === s.id) {
          return (
            <span key={s.id} className="flex items-center gap-1">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                className="h-8 w-32"
              />
              <button onClick={commitRename} className="h-8 w-8 rounded-lg text-success hover:bg-bg-soft flex items-center justify-center" title="Сохранить">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setEditingId(null)} className="h-8 w-8 rounded-lg text-text-muted hover:bg-bg-soft flex items-center justify-center" title="Отмена">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        }
        return (
          <span key={s.id} className="group flex items-center">
            <button
              onClick={() => setActive(s.id)}
              className={`h-8 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                isActive ? 'bg-accent text-white' : 'bg-bg-soft text-text-muted hover:text-text hover:bg-bg-hover'
              }`}
            >
              {s.name}
            </button>
            {isActive && (
              <span className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={() => startRename(s.id, s.name)} className="h-8 w-7 rounded-lg text-text-muted hover:text-text flex items-center justify-center" title="Переименовать экран">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {screens.length > 1 && (
                  <button
                    onClick={() => { if (window.confirm(`Удалить экран «${s.name}»? Раскладка этого экрана пропадёт.`)) remove(s.id); }}
                    className="h-8 w-7 rounded-lg text-text-muted hover:text-danger flex items-center justify-center"
                    title="Удалить экран"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            )}
          </span>
        );
      })}

      <button
        onClick={() => setAddOpen(true)}
        className="h-8 w-8 rounded-lg border border-dashed border-border text-text-muted hover:text-text hover:border-text flex items-center justify-center transition-colors"
        title="Новый экран"
      >
        <Plus className="h-4 w-4" />
      </button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый экран</DialogTitle>
            <DialogDescription>Отдельный дашборд со своим набором виджетов — например «Работа» или «Здоровье».</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
            placeholder="Название экрана…"
          />
          <div className="mt-3">
            <div className="text-[11px] text-text-muted mb-1.5">Шаблон</div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {SCREEN_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTpl(t.id)}
                  className={`w-full text-left rounded-xl border p-2.5 transition-colors ${
                    tpl === t.id ? 'border-accent bg-accent/5' : 'border-border-soft hover:border-border'
                  }`}
                >
                  <div className="text-[13px] font-medium text-text">{t.label}</div>
                  <div className="text-[11px] text-text-muted">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitAdd}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
