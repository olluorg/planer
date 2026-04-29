import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resetDB, persist } from "@/lib/db";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import {
  Download,
  Upload,
  RefreshCw,
  Sun,
  Moon,
  Bell,
  BellOff,
  Puzzle,
} from "lucide-react";
import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { isExtension, getExtSetting, setExtSetting } from "@/lib/extension";

const BLOCK_SCHEDULE = [
  { key: "morning", label: "Утро", time: "07:00" },
  { key: "day", label: "День", time: "12:00" },
  { key: "evening", label: "Вечер", time: "18:00" },
  { key: "night", label: "Ночь", time: "21:00" },
];

export const SettingsPage = () => {
  const reload = useStore((s) => s.reload);
  const { theme, setTheme } = useTheme();
  const [notifEnabled, setNotifEnabled] = useState(true);

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
    const blob = await get<Uint8Array>("thedad.sqlite.v1");
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
    await set("thedad.sqlite.v1", buf);
    location.reload();
  };

  const reset = async () => {
    if (!confirm("Удалить все данные и пересоздать БД?")) return;
    await resetDB();
    reload();
    location.reload();
  };

  return (
    <div className="p-4 max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Настройки</h1>

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
          <Button variant="danger" onClick={reset}>
            <RefreshCw /> Сбросить
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Уведомления</CardTitle>
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
