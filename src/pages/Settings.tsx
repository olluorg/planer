import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resetDB, persist, DB_KEY } from "@/lib/db";
import { useStore } from "@/lib/store";
import { useTheme, isGlass } from "@/lib/theme";
import {
  Download, Upload, RefreshCw, Sun, Moon, Bell, BellOff, Puzzle, FileText, FileJson, Sparkles, X, CalendarDays, Cpu, GraduationCap,
} from "lucide-react";
import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { isExtension, getExtSetting, setExtSetting } from "@/lib/extension";
import { parseCsv, readFileText } from "@/lib/importCsv";
import { isHeartbeatEnabled, setHeartbeatEnabled } from "@/lib/notifications";
import { isSoundEnabled, setSoundEnabled, playSuccess } from "@/lib/sound";
import { toast } from "@/lib/toast";
import { ACCENTS, APP_WALLPAPERS, applyAppWallpaper, getAppWallpaper, getCustomWallpapers, addCustomWallpaper, removeCustomWallpaper } from "@/lib/theme";
import { getIconStyle, setIconStyle, type IconStyle } from "@/lib/iconStyle";
import { compressImage } from "@/lib/imageCompress";
import { getAiConfig, setAiConfig, askAI, AI_PROVIDERS, type AiConfig } from "@/lib/ai";
import { parseIcs } from "@/lib/ics";
import { SyncSettings } from "@/components/SyncSettings";
import { buildWeeklyMarkdown, downloadText, printWeeklyReport } from "@/lib/report";
import { encryptBytes, decryptBytes } from "@/lib/cryptoExport";
import { getInstalledPlugins, installPlugin, removePlugin, exportPlugin, PLUGINS_EVENT } from "@/lib/plugins";
import { preloadImages } from "@/lib/preload";
import { getLiveWallpaper, setYouTubeWallpaper, setVideoWallpaper, clearLiveWallpaper, LIVEWP_EVENT } from "@/lib/liveWallpaper";
import { chromeAiPresent, chromeAvailability, chromePreferred, setChromePreferred, downloadChromeModel, type Availability } from "@/lib/aiProvider";
import { ChromeAiSetupModal } from "@/components/ChromeAiSetupModal";
import { LearnModal } from "@/components/LearnModal";
import { AboutModal } from "@/components/AboutModal";
import { Info } from "lucide-react";
import { parseYouTubeId } from "@/components/LiveWallpaper";
import { Clapperboard } from "lucide-react";
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

  const exportWeeklyPdf = () => {
    const s = useStore.getState();
    printWeeklyReport(new Date(), {
      goals: s.goals, tasks: s.tasks, habits: s.habits,
      habitLogs: s.habitLogs, progress: s.progress, reflections: s.reflections,
    });
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

  const importIcsFile = async (file: File) => {
    try {
      const text = await readFileText(file);
      const events = parseIcs(text);
      let imported = 0;
      events.forEach((ev) => { addTask({ title: ev.title, date: ev.date, start_time: ev.start_time }); imported++; });
      if (imported) toast.success(`Импортировано событий: ${imported}`, 'Из календаря (.ics)');
      else toast.error('События не найдены', 'Проверь файл .ics');
    } catch (e: any) {
      toast.error('Ошибка импорта .ics', String(e?.message ?? e));
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

  const [learnOpen, setLearnOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="page py-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-h1">Настройки</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Обучение: сетка мини-онбордингов (как сменить тему, включить AI, собрать дашборд…) */}
          <Button variant="soft" onClick={() => setLearnOpen(true)}>
            <GraduationCap className="h-4 w-4" /> Обучение
          </Button>
          <Button variant="soft" onClick={() => setAboutOpen(true)}>
            <Info className="h-4 w-4" /> О приложении
          </Button>
        </div>
      </div>
      <LearnModal open={learnOpen} onClose={() => setLearnOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* Разделы-«карточки» раскладываются в колонки по ширине экрана (masonry) */}
      <div className="columns-1 lg:columns-2 2xl:columns-3 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4">
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
            variant={isGlass(theme) ? "default" : "soft"}
            onClick={() => setTheme(theme === "glass-light" ? "glass-light" : "glass")}
          >
            <Sparkles className="h-4 w-4" /> Glass
          </Button>
        </div>
        {isGlass(theme) && (
          <div className="mt-3 flex gap-2">
            <Button variant={theme === "glass" ? "default" : "soft"} size="sm" onClick={() => setTheme("glass")}>
              <Moon className="h-3.5 w-3.5" /> Тёмное стекло
            </Button>
            <Button variant={theme === "glass-light" ? "default" : "soft"} size="sm" onClick={() => setTheme("glass-light")}>
              <Sun className="h-3.5 w-3.5" /> Светлое стекло
            </Button>
          </div>
        )}
        {isGlass(theme) && <GlassWallpaperPicker />}
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
        <CardTitle>Плагины — свои виджеты</CardTitle>
        <PluginsSettings />
      </Card>

      <Card>
        <CardTitle>Синхронизация устройств</CardTitle>
        <SyncSettings />
      </Card>

      <Card>
        <CardTitle>AI-коуч</CardTitle>
        <AiSettings />
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
          <Button variant="soft" onClick={exportWeeklyPdf}>
            <FileText /> Отчёт PDF
          </Button>
          <Button
            variant="soft"
            onClick={() => {
              const ok = useStore.getState().seedDemoData();
              if (ok) toast.success('Примеры загружены', 'Демо-цели, задачи и привычки');
              else toast.info('У вас уже есть данные', 'Примеры добавляются только на чистый старт');
            }}
          >
            <Sparkles /> Загрузить примеры
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
          <label>
            <input
              type="file" accept=".ics,text/calendar" className="hidden"
              onChange={(e) => e.target.files?.[0] && importIcsFile(e.target.files[0])}
            />
            <Button variant="soft" asChild>
              <span><CalendarDays /> Календарь .ics</span>
            </Button>
          </label>
        </div>
        <div className="text-[11px] text-text-muted mt-2">.ics — экспорт из Google Calendar / Apple Calendar / Outlook: события станут задачами с датой и временем.</div>
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
            <span className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform ${heartbeat ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm">
            Утро (08:00) и вечер (21:00) — пуш с фокусом дня и напоминанием о рефлексии.
          </span>
        </label>
        <div className="text-[11px] text-text-muted mt-2">Системные уведомления приходят, пока приложение открыто (вкладка или установленное PWA). Для надёжности установи THEDAD как приложение и держи в фоне — фоновой доставки при полностью закрытом приложении нет (нужен сервер).</div>

        <CardTitle className="mt-6">Звук при действии</CardTitle>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={sound}
            onClick={() => toggleSound(!sound)}
            className={`relative w-10 h-6 shrink-0 rounded-full transition-colors ${sound ? 'bg-accent' : 'bg-bg-soft border border-border'}`}
          >
            <span className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform ${sound ? 'translate-x-5' : 'translate-x-1'}`} />
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
    </div>
  );
};

/* Плагины: декларативные JSON-виджеты (уровень A по docs/PLUGINS_SPEC.md).
   Без исполняемого кода: только данные из белого списка коллекций + готовые примитивы. */
const PluginsSettings: React.FC = () => {
  const [plugins, setPlugins] = useState(getInstalledPlugins());
  useEffect(() => {
    const sync = () => setPlugins(getInstalledPlugins());
    window.addEventListener(PLUGINS_EVENT, sync);
    return () => window.removeEventListener(PLUGINS_EVENT, sync);
  }, []);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const p = installPlugin(JSON.parse(await file.text()));
      toast.success(`Плагин «${p.name}» установлен`, "Добавь его на дашборд через редактор раскладки → «+»");
    } catch (err: any) {
      toast.error("Плагин не установлен", String(err?.message ?? err));
    }
  };

  return (
    <div>
      <div className="text-sm text-text-muted mb-3">
        Кастомные виджеты — файлы <code className="text-xs">.thedad-widget.json</code>: данные из твоего стора
        (read-only) + готовый вид (число, список, график, кольцо, таблица). Без исполняемого кода —
        импортированный виджет не может читать AI-ключ или отправлять данные в сеть.
        Примеры — в <code className="text-xs">docs/plugins</code> репозитория.
      </div>
      {plugins.length > 0 && (
        <ul className="space-y-2 mb-3">
          {plugins.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border-soft px-3 py-2">
              <Puzzle className="h-4 w-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-[11px] text-text-muted truncate">
                  {p.id}{p.author ? ` · ${p.author}` : ""} · {p.source.collection} → {p.render.type}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => exportPlugin(p)} title="Выгрузить .json для шаринга">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => { removePlugin(p.id); toast.success(`Плагин «${p.name}» удалён`); }}
                title="Удалить плагин"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {plugins.length === 0 && (
        <div className="text-xs text-text-dim mb-3">Пока ничего не установлено.</div>
      )}
      <label className="inline-flex">
        <span className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-bg-soft hover:bg-bg-hover text-sm cursor-pointer transition-colors">
          <Upload className="h-4 w-4" /> Импортировать .json
        </span>
        <input type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
      </label>
    </div>
  );
};

/* Выбор обоев для glass-темы: готовые + свои (сохраняются в список) */
const GlassWallpaperPicker: React.FC = () => {
  const [current, setCurrent] = useState(getAppWallpaper());
  const [custom, setCustom] = useState<string[]>(getCustomWallpapers());
  // прогреваем кеш всех обоев, чтобы превью и смена фона не «проявлялись»
  useEffect(() => { preloadImages([...custom, ...APP_WALLPAPERS]); }, [custom]);
  const pick = (src: string) => { applyAppWallpaper(src); setCurrent(src); };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      // сжимаем: сырые фото в base64 пробивают квоту localStorage и молча не сохранялись
      const dataUrl = await compressImage(file);
      setCustom(addCustomWallpaper(dataUrl)); // сохраняем в список, чтобы не пропало
      pick(dataUrl);
      toast.success("Обои добавлены");
    } catch (err: any) {
      toast.error("Не удалось загрузить обои", String(err?.message ?? err));
    }
  };
  const del = (src: string) => {
    setCustom(removeCustomWallpaper(src));
    if (current === src) pick(APP_WALLPAPERS[0]);
  };
  return (
    <div className="mt-4">
      <div className="text-[11px] text-text-muted mb-2">Обои</div>
      <div className="flex gap-2 flex-wrap items-center">
        {[...custom, ...APP_WALLPAPERS].map((w) => {
          const isCustom = custom.includes(w);
          return (
            <div key={w} className="relative group">
              <button
                onClick={() => pick(w)}
                className={`h-11 w-[72px] rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${current === w ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                <img src={w} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
              {isCustom && (
                <button
                  onClick={() => del(w)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Удалить"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}
        <label className="h-11 w-[72px] rounded-lg border-2 border-dashed border-border hover:border-accent flex flex-col items-center justify-center text-text-muted hover:text-text cursor-pointer transition-colors">
          <Upload className="h-3.5 w-3.5" />
          <span className="text-[9px] mt-0.5">Свой</span>
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      </div>
      <LiveWallpaperControls />
    </div>
  );
};

/* Живые обои: видеофайл (mp4/webm) или YouTube-ссылка как анимированный фон */
const LiveWallpaperControls: React.FC = () => {
  const [wp, setWp] = useState(getLiveWallpaper());
  const [link, setLink] = useState("");
  useEffect(() => {
    const sync = () => setWp(getLiveWallpaper());
    window.addEventListener(LIVEWP_EVENT, sync);
    return () => window.removeEventListener(LIVEWP_EVENT, sync);
  }, []);

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { toast.error("Видео больше 60 МБ", "Возьми короткий зацикленный ролик"); return; }
    try { await setVideoWallpaper(file); toast.success("Живые обои установлены"); }
    catch (err: any) { toast.error("Не удалось сохранить видео", String(err?.message ?? err)); }
  };
  const onLink = () => {
    const id = parseYouTubeId(link.trim());
    if (!id) { toast.error("Не похоже на ссылку YouTube"); return; }
    setYouTubeWallpaper(id);
    setLink("");
    toast.success("YouTube-обои установлены");
  };

  return (
    <div className="mt-4 rounded-xl border border-border-soft p-3">
      <div className="flex items-center gap-2 mb-2">
        <Clapperboard className="h-4 w-4 text-accent" />
        <div className="text-[13px] font-medium text-text">Живые обои</div>
        {wp && <span className="text-[10px] text-accent">активны · {wp.kind === "youtube" ? "YouTube" : "видео"}</span>}
      </div>
      <div className="text-[11px] text-text-muted mb-2.5">
        Видеофайл (mp4/webm, как в Lively Wallpaper) или ссылка YouTube. Показываются в glass-теме, без звука, зациклено.
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-bg-soft hover:bg-bg-hover text-sm cursor-pointer transition-colors">
          <Upload className="h-4 w-4" /> Видеофайл
          <input type="file" accept="video/mp4,video/webm,video/*" className="hidden" onChange={onVideo} />
        </label>
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Ссылка YouTube…" className="h-9 flex-1 min-w-[160px]"
          onKeyDown={(e) => e.key === "Enter" && onLink()} />
        <Button size="sm" variant="soft" onClick={onLink}>Задать</Button>
        {wp && <Button size="sm" variant="ghost" onClick={() => { void clearLiveWallpaper(); }}>Убрать</Button>}
      </div>
    </div>
  );
};

/* Встроенный в Chrome ИИ (Prompt API, Gemini Nano): работает локально и бесплатно.
   Приоритетный провайдер; свой ключ остаётся фолбэком. */
const BuiltInAiControls: React.FC = () => {
  const [avail, setAvail] = useState<Availability | null>(null);
  const [on, setOn] = useState(chromePreferred());
  const [pct, setPct] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const present = chromeAiPresent();
  useEffect(() => { void chromeAvailability().then(setAvail); }, []);

  // Скачивание модели обязано идти из обработчика клика — иначе Chrome требует «user gesture»
  const download = async () => {
    setPct(0);
    try {
      await downloadChromeModel(setPct);
      setAvail(await chromeAvailability());
      toast.success('Модель встроенного AI готова');
    } catch (e: any) {
      toast.error('Не удалось скачать модель', String(e?.message ?? e));
    } finally {
      setPct(null);
    }
  };

  const status = !present
    ? { text: 'Не поддерживается этим браузером', cls: 'text-text-dim' }
    : avail === 'available' ? { text: 'Готов к работе', cls: 'text-success' }
    : avail === 'downloadable' ? { text: 'Модель не скачана — нажми «Скачать модель»', cls: 'text-text-muted' }
    : avail === 'downloading' ? { text: 'Модель скачивается…', cls: 'text-text-muted' }
    : { text: 'Недоступен — включи в chrome://flags', cls: 'text-text-dim' };

  return (
    <div className="rounded-xl border border-border-soft p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Cpu className="h-4 w-4 text-accent" />
        <div className="text-[13px] font-medium text-text flex-1">Встроенный AI Chrome</div>
        <button
          onClick={() => { const v = !on; setOn(v); setChromePreferred(v); }}
          disabled={!present}
          role="switch"
          aria-checked={on && present}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on && present ? 'bg-success' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow transition-transform ${on && present ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className={`text-[11px] ${status.cls}`}>{status.text}</div>
      {pct !== null && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-bg-soft overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[11px] text-text-muted mt-1 tabular-nums">Скачивание модели · {pct}%</div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {present && on && (avail === 'downloadable' || avail === 'downloading') && pct === null && (
          <Button size="sm" variant="soft" onClick={download}>Скачать модель (~1–2 ГБ, один раз)</Button>
        )}
        {avail !== 'available' && (
          <Button size="sm" variant="ghost" onClick={() => setHelpOpen(true)}>Как включить? Инструкция</Button>
        )}
      </div>
      <div className="text-[11px] text-text-dim mt-1.5 leading-relaxed">
        Работает <b className="text-text-muted">только в Chrome</b> (Gemini Nano прямо в браузере: бесплатно,
        офлайн, данные никуда не уходят). В других браузерах — Safari, Firefox, на телефоне — добавь ниже
        свой ключ OpenAI, Claude, Gemini или локальную Ollama.
      </div>
      <ChromeAiSetupModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
};

/* Настройки AI-коуча: ключ хранится локально, запрос идёт напрямую к провайдеру */
const AiSettings: React.FC = () => {
  const [cfg, setCfg] = useState(getAiConfig());
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  // Патч уходит в стор (он же подставляет дефолты провайдера), стейт перечитываем разрешённым
  const save = (patch: Partial<AiConfig>) => {
    setAiConfig(patch);
    setCfg(getAiConfig());
  };
  const meta = AI_PROVIDERS.find((p) => p.id === cfg.provider) ?? AI_PROVIDERS[0];
  const keyless = cfg.provider === 'ollama'; // локальная модель, авторизация не нужна
  const keyPlaceholder = keyless ? 'не нужен' : cfg.provider === 'anthropic' ? 'sk-ant-…' : cfg.provider === 'gemini' ? 'AIza…' : 'sk-…';
  const test = async () => {
    setTesting(true);
    try {
      const reply = await askAI([{ role: 'user', content: 'Ответь одним словом: работает?' }]);
      toast.success('Ключ работает', reply.slice(0, 60));
    } catch (e: any) {
      toast.error('Не удалось подключиться', String(e?.message ?? e));
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="space-y-3">
      <BuiltInAiControls />
      <div className="text-sm text-text-muted">
        Запасной вариант — свой ключ. Используется, если встроенный AI недоступен (не Chrome) или выключен.
        Ключ и запросы остаются на твоём устройстве, ничего не проходит через наши серверы.
      </div>
      {/* Провайдер: у OpenAI / Claude / Gemini разные адреса и формат запроса */}
      <div>
        <div className="text-[11px] text-text-muted mb-1">Провайдер</div>
        <div className="flex flex-wrap gap-1.5">
          {AI_PROVIDERS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={cfg.provider === p.id ? 'default' : 'soft'}
              onClick={() => save({ provider: p.id, endpoint: undefined, model: undefined })}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="text-[11px] text-text-dim mt-1.5">{AI_PROVIDERS.find((p) => p.id === cfg.provider)?.hint}</div>
      </div>
      <div>
        <div className="text-[11px] text-text-muted mb-1">API-ключ</div>
        <div className="flex gap-2">
          <Input
            type={show ? 'text' : 'password'}
            placeholder={keyPlaceholder}
            value={cfg.key}
            onChange={(e) => save({ key: e.target.value })}
            className="flex-1"
          />
          <Button variant="soft" size="sm" onClick={() => setShow((v) => !v)}>{show ? 'Скрыть' : 'Показать'}</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-text-muted mb-1">Endpoint</div>
          <Input placeholder={meta.endpoint || 'https://…'} value={cfg.endpoint} onChange={(e) => save({ endpoint: e.target.value })} />
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-1">Модель</div>
          <Input placeholder={meta.model || 'название модели'} value={cfg.model} onChange={(e) => save({ model: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={test} disabled={(!cfg.key && !keyless) || testing}>{testing ? 'Проверка…' : keyless ? 'Проверить подключение' : 'Проверить ключ'}</Button>
        {cfg.key && <Button variant="soft" size="sm" onClick={() => save({ key: '' })}>Отключить</Button>}
      </div>
      <div className="text-[11px] text-text-dim">
        OpenAI, Claude и Gemini поддержаны напрямую — прокси не нужен. Вариант «Свой» подойдёт для
        OpenRouter и локальных моделей с OpenAI-совместимым API.
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
