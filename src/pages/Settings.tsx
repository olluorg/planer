import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resetDB, persist, DB_KEY } from "@/lib/db";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import {
  Download, Upload, RefreshCw, Sun, Moon, Bell, BellOff, Puzzle, FileText, FileJson, Sparkles,
} from "lucide-react";
import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { isExtension, getExtSetting, setExtSetting } from "@/lib/extension";
import { parseCsv, readFileText } from "@/lib/importCsv";
import { isHeartbeatEnabled, setHeartbeatEnabled } from "@/lib/notifications";
import { isSoundEnabled, setSoundEnabled, playSuccess } from "@/lib/sound";
import { toast } from "@/lib/toast";
import { ACCENTS, APP_WALLPAPERS, applyAppWallpaper, getAppWallpaper } from "@/lib/theme";
import { getIconStyle, setIconStyle, type IconStyle } from "@/lib/iconStyle";
import { compressImage } from "@/lib/imageCompress";
import { buildWeeklyMarkdown, downloadText } from "@/lib/report";
import { encryptBytes, decryptBytes } from "@/lib/cryptoExport";
import { loadReminders, saveReminders, requestPermission, scheduleAll, type Reminder } from "@/lib/notifications";
import { Input } from "@/components/ui/input";
import { nanoid } from "nanoid";

const BLOCK_SCHEDULE = [
  { key: "morning", label: "Утро", time: "07:00" },
  { key: "day", label: "День", time: "12:00" },
  { key: "evening", label: "Вечер", time: "18:00" },
  { key: "night", label: "Ночь", time: "21:00" },
];

export const SettingsPage = () => {
  const reload = useStore((s) => s.reload);
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [heartbeat, setHeartbeat] = useState(isHeartbeatEnabled());
  const [sound, setSound] = useState(isSoundEnabled());
  const toggleSound = (v: boolean) => {
    setSoundEnabled(v); setSound(v);
    if (v) setTimeout(() => playSuccess(), 50);
  };
  const toggleHeartbeat = async (v: boolean) => {
    if (v) {
      const p = await requestPermission();
      if (p !== 'granted') { alert('Разрешите уведомления в браузере'); return; }
    }
    setHeartbeatEnabled(v);
    setHeartbeat(v);
    location.reload();
  };

  useEffect(() => {
    if (!isExtension) return;
    getExtSetting<boolean>("planer_notifications_enabled", true).then(
      setNotifEnabled,
    );
  }, []);

  const toggleNotif = async (val: boolean) => {
    setNotifEnabled(val);
    await setExtSetting("planer_notifications_enabled", val);
  };

  const exportDb = async () => {
    await persist();
    const blob = await get<Uint8Array>(DB_KEY);
    if (!blob) return;
    const url = URL.createObjectURL(
      new Blob([blob.buffer as ArrayBuffer], {
        type: "application/octet-stream",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `thedad-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDb = async (file: File) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    await set(DB_KEY, buf);
    location.reload();
  };

  const reset = async () => {
    if (!confirm("Удалить все данные и пересоздать БД?")) return;
    await resetDB();
    reload();
    location.reload();
  };

  const [reminders, setReminders] = useState<Reminder[]>(() => loadReminders());
  const [reminderText, setReminderText] = useState("");
  const [reminderTime, setReminderTime] = useState("18:00");
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  useEffect(() => { scheduleAll(); }, []);

  const persistReminders = (r: Reminder[]) => { setReminders(r); saveReminders(r); };
  const askPermission = async () => { setPermission(await requestPermission()); scheduleAll(); };
  const addReminder = () => {
    if (!reminderText.trim()) return;
    persistReminders([...reminders, { id: nanoid(8), text: reminderText.trim(), time: reminderTime, enabled: true }]);
    setReminderText("");
  };
  const addTask = useStore((s) => s.addTask);
  const addHabit = useStore((s) => s.addHabit);
  const addGoal = useStore((s) => s.addGoal);

  const importCsvFile = async (file: File, kind: "tasks" | "habits" | "goals") => {
    try {
      const text = await readFileText(file);
      const rows = parseCsv(text);
      let imported = 0;
      for (const r of rows) {
        if (kind === "tasks" && r.title) {
          addTask({
            title: r.title,
            date: r.date || new Date().toISOString().slice(0, 10),
            time_block: (r.time_block as any) || null,
            priority: r.priority ? Number(r.priority) : 2,
            tags: r.tags || null,
            notes: r.notes || null,
            estimate_min: r.estimate_min ? Number(r.estimate_min) : null,
          });
          imported++;
        } else if (kind === "habits" && r.title) {
          addHabit({ title: r.title, color: r.color || null, schedule: (r.schedule as any) || "daily" });
          imported++;
        } else if (kind === "goals" && r.title) {
          addGoal({
            title: r.title,
            type: (r.type as any) || "mid",
            start_value: r.start_value ? Number(r.start_value) : 0,
            target_value: r.target_value ? Number(r.target_value) : 100,
            unit: r.unit || null,
            deadline: r.deadline || null,
          });
          imported++;
        }
      }
      toast.success(`Импортировано: ${imported}`, `Из CSV (${kind})`);
    } catch (e: any) {
      toast.error('Ошибка импорта', String(e?.message ?? e));
    }
  };

  const exportWeeklyReport = () => {
    const s = useStore.getState();
    const md = buildWeeklyMarkdown(new Date(), {
      goals: s.goals, tasks: s.tasks, habits: s.habits,
      habitLogs: s.habitLogs, progress: s.progress, reflections: s.reflections,
    });
    downloadText(`thedad-week-${new Date().toISOString().slice(0, 10)}.md`, md);
  };

  const exportEncrypted = async () => {
    const pass = window.prompt('Пароль для шифрования (минимум 8 символов):');
    if (!pass || pass.length < 8) { alert('Слишком короткий пароль'); return; }
    await persist();
    const blob = await get<Uint8Array>(DB_KEY);
    if (!blob) return;
    const enc = await encryptBytes(blob, pass);
    const url = URL.createObjectURL(new Blob([enc.buffer as ArrayBuffer], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `thedad-${new Date().toISOString().slice(0, 10)}.sqlite.enc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importEncrypted = async (file: File) => {
    const pass = window.prompt('Пароль для расшифровки:');
    if (!pass) return;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const dec = await decryptBytes(buf, pass);
      await set(DB_KEY, dec);
      location.reload();
    } catch (e: any) {
      alert('Не удалось расшифровать: ' + (e?.message ?? e));
    }
  };

  const importJsonFile = async (file: File) => {
    try {
      const text = await readFileText(file);
      const data = JSON.parse(text);
      let imported = 0;
      if (Array.isArray(data?.goals)) data.goals.forEach((g: any) => g.title && (addGoal(g), imported++));
      if (Array.isArray(data?.habits)) data.habits.forEach((h: any) => h.title && (addHabit(h), imported++));
      if (Array.isArray(data?.tasks)) data.tasks.forEach((t: any) => t.title && (addTask(t), imported++));
      toast.success(`Импортировано из JSON: ${imported}`);
    } catch (e: any) {
      toast.error('Ошибка импорта JSON', String(e?.message ?? e));
    }
  };

  return (
    <div className="p-4 max-w-2xl space-y-4">
      <h1 className="text-h1">Настройки</h1>

      <Card>
        <CardTitle>Внешний вид</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={theme === "light" ? "default" : "soft"}
            onClick={() => setTheme("light")}
          >
            <Sun className="h-4 w-4" /> Светлая
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "soft"}
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-4 w-4" /> Тёмная
          </Button>
          <Button
            variant={theme === "glass" ? "default" : "soft"}
            onClick={() => setTheme("glass")}
          >
            <Sparkles className="h-4 w-4" /> Glass
          </Button>
        </div>
        {theme === "glass" && <GlassWallpaperPicker />}
        <div className="text-[11px] text-text-muted mt-4 mb-2">Иконки наград</div>
        <IconStylePicker />
        <div className="text-[11px] text-text-muted mt-4 mb-2">Акцентный цвет</div>
        <div className="flex gap-2 flex-wrap">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              title={a.label}
              className={`h-8 w-8 border ${accent === a.id ? 'border-text' : 'border-border'} transition-colors`}
              style={{ background: a.color }}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>База данных (SQLite WASM)</CardTitle>
        <div className="text-sm text-text-muted mb-4">
          Все данные хранятся локально в IndexedDB через WebAssembly-сборку
          SQLite. Можно выгрузить в файл или импортировать обратно.
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="soft" onClick={exportDb}>
            <Download /> Экспорт .sqlite
          </Button>
          <label>
            <input
              type="file"
              accept=".sqlite,.db,application/octet-stream"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && importDb(e.target.files[0])
              }
            />
            <Button variant="soft" asChild>
              <span>
                <Upload /> Импорт .sqlite
              </span>
            </Button>
          </label>
          <Button variant="soft" onClick={exportEncrypted}>
            <Download /> Зашифровать .sqlite.enc
          </Button>
          <label>
            <input
              type="file" accept=".enc,application/octet-stream" className="hidden"
              onChange={(e) => e.target.files?.[0] && importEncrypted(e.target.files[0])}
            />
            <Button variant="soft" asChild>
              <span><Upload /> Импорт .sqlite.enc</span>
            </Button>
          </label>
          <Button variant="soft" onClick={exportWeeklyReport}>
            <FileText /> Отчёт за неделю (.md)
          </Button>
          <Button
            variant="soft"
            onClick={() => { localStorage.removeItem('onboarding.done.v1'); location.reload(); }}
          >
            <Sparkles /> Пройти onboarding снова
          </Button>
          <Button variant="danger" onClick={reset}>
            <RefreshCw /> Сбросить
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Импорт данных</CardTitle>
        <div className="text-sm text-text-muted mb-3">
          CSV-колонки для задач: <code>title, date, time_block, priority, tags, notes, estimate_min</code>.<br />
          Для привычек: <code>title, color, schedule</code>. Для целей: <code>title, type, start_value, target_value, unit, deadline</code>.<br />
          JSON: объект с массивами <code>{`{ goals, habits, tasks }`}</code>.
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["tasks", "habits", "goals"] as const).map((kind) => (
            <label key={kind}>
              <input
                type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && importCsvFile(e.target.files[0], kind)}
              />
              <Button variant="soft" asChild>
                <span><FileText /> CSV: {kind}</span>
              </Button>
            </label>
          ))}
          <label>
            <input
              type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => e.target.files?.[0] && importJsonFile(e.target.files[0])}
            />
            <Button variant="soft" asChild>
              <span><FileJson /> JSON</span>
            </Button>
          </label>
        </div>
      </Card>

      <Card>
        <CardTitle>Локальные напоминания</CardTitle>
        <div className="text-sm text-text-muted mb-3">
          {permission === 'granted'
            ? 'Разрешение получено. Напоминания приходят пока вкладка открыта.'
            : permission === 'denied'
              ? 'Уведомления заблокированы в настройках браузера.'
              : 'Нужно разрешить уведомления.'}
        </div>
        {permission !== 'granted' && (
          <Button variant="soft" size="sm" onClick={askPermission} className="mb-3"><Bell /> Разрешить</Button>
        )}
        <div className="flex gap-2 flex-wrap mb-3">
          <Input className="flex-1 min-w-[160px]" placeholder="Текст напоминания" value={reminderText}
            onChange={(e) => setReminderText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addReminder()} />
          <Input type="time" className="w-32" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
          <Button onClick={addReminder} size="sm"><Bell /> Добавить</Button>
        </div>
        <div className="space-y-1">
          {reminders.length === 0 && <div className="text-xs text-text-dim">Нет напоминаний</div>}
          {reminders.map((r) => (
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={r.enabled} onChange={() =>
                persistReminders(reminders.map((x) => x.id === r.id ? { ...x, enabled: !x.enabled } : x))
              } />
              <span className="font-mono text-xs w-12">{r.time}</span>
              <span className="flex-1">{r.text}</span>
              <button onClick={() => persistReminders(reminders.filter((x) => x.id !== r.id))}
                className="text-text-dim hover:text-danger">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <CardTitle className="mt-6">Heartbeat-уведомления</CardTitle>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={heartbeat}
            onClick={() => toggleHeartbeat(!heartbeat)}
            className={`relative w-10 h-6 shrink-0 rounded-full transition-colors ${heartbeat ? 'bg-accent' : 'bg-bg-soft border border-border'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${heartbeat ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm">
            Утро (08:00) и вечер (21:00) — пуш с фокусом дня и напоминанием о рефлексии.
          </span>
        </label>
        <div className="text-[11px] text-text-muted mt-2">Работает только пока вкладка открыта (без сервера VAPID).</div>

        <CardTitle className="mt-6">Звук при действии</CardTitle>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={sound}
            onClick={() => toggleSound(!sound)}
            className={`relative w-10 h-6 shrink-0 rounded-full transition-colors ${sound ? 'bg-accent' : 'bg-bg-soft border border-border'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${sound ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm">Короткий beep при выполнении задачи и unlock-ачивке.</span>
        </label>

        <CardTitle className="mt-6">Расширение Chrome (опционально)</CardTitle>
        {isExtension ? (
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={notifEnabled}
                onClick={() => toggleNotif(!notifEnabled)}
                className={`relative w-10 h-6 rounded-full transition-colors ${notifEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifEnabled ? "translate-x-5" : "translate-x-1"}`}
                />
              </button>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {notifEnabled ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4 text-text-muted" />
                )}
                Напоминания о задачах
              </span>
            </label>
            <div className="grid grid-cols-2 gap-1 text-sm text-text-muted">
              {BLOCK_SCHEDULE.map(({ label, time }) => (
                <div key={label} className="flex justify-between gap-4">
                  <span>{label}</span>
                  <span className="font-mono">{time}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-text-muted">
            <Puzzle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Установите расширение Chrome чтобы получать напоминания о задачах
              — даже когда вкладка закрыта.
            </span>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>О приложении</CardTitle>
        <ul className="text-sm space-y-1 text-text-muted">
          <li>React + Vite, shadcn/ui, Apache ECharts, dnd-kit</li>
          <li>SQLite (sql.js + WASM), персист в IndexedDB</li>
          <li>Прогноз: линейная регрессия + 95% доверительный интервал</li>
          <li>Работает офлайн</li>
        </ul>
      </Card>
    </div>
  );
};

/* Выбор обоев для glass-темы: готовые + свой файл */
const GlassWallpaperPicker: React.FC = () => {
  const [current, setCurrent] = useState(getAppWallpaper());
  const pick = (src: string) => { applyAppWallpaper(src); setCurrent(src); };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      // сжимаем: сырые фото в base64 пробивают квоту localStorage и молча не сохранялись
      const dataUrl = await compressImage(file);
      pick(dataUrl);
      toast.success("Обои применены");
    } catch (err: any) {
      toast.error("Не удалось загрузить обои", String(err?.message ?? err));
    }
  };
  return (
    <div className="mt-4">
      <div className="text-[11px] text-text-muted mb-2">Обои</div>
      <div className="flex gap-2 flex-wrap items-center">
        {APP_WALLPAPERS.map((w) => (
          <button
            key={w}
            onClick={() => pick(w)}
            className={`h-11 w-[72px] rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${current === w ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"}`}
          >
            <img src={w} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
        <label className="h-11 w-[72px] rounded-lg border-2 border-dashed border-border hover:border-accent flex flex-col items-center justify-center text-text-muted hover:text-text cursor-pointer transition-colors">
          <Upload className="h-3.5 w-3.5" />
          <span className="text-[9px] mt-0.5">Свой</span>
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      </div>
    </div>
  );
};

/* Переключатель стиля игровых иконок: минималистичные SVG или эмодзи */
const IconStylePicker: React.FC = () => {
  const [style, setStyle] = useState<IconStyle>(getIconStyle());
  const pick = (s: IconStyle) => { setIconStyle(s); setStyle(s); };
  return (
    <div className="flex gap-2">
      <Button variant={style === "svg" ? "default" : "soft"} size="sm" onClick={() => pick("svg")}>
        SVG (минимализм)
      </Button>
      <Button variant={style === "emoji" ? "default" : "soft"} size="sm" onClick={() => pick("emoji")}>
        Эмодзи
      </Button>
    </div>
  );
};
