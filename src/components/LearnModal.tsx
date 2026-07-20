import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, GraduationCap } from 'lucide-react';

/** Мини-онбординги: один «квадратик» = одна короткая инструкция. Данные, не код —
 *  добавить тему = добавить объект. Открывается из Настроек → «Обучение». */
interface Topic { id: string; emoji: string; title: string; blurb: string; steps: string[] }

const TOPICS: Topic[] = [
  {
    id: 'theme', emoji: '🎨', title: 'Сменить тему', blurb: 'Тёмная, светлая и «стекло»',
    steps: [
      'Нажми на иконку луны/солнца в шапке справа — переключает тёмную и светлую темы.',
      'В Настройках → «Оформление» есть стеклянные темы (glass) с живыми обоями.',
      'Там же выбирается акцентный цвет и фон.',
    ],
  },
  {
    id: 'ai', emoji: '🤖', title: 'Включить бесплатный AI', blurb: 'Gemini Nano в Chrome',
    steps: [
      'Настройки → «AI-коуч» → блок «Встроенный AI Chrome».',
      'Нажми «Как включить? Инструкция» — там пошагово про флаги Chrome.',
      'После включения скачай модель (один раз) — AI заработает офлайн и бесплатно.',
      'В других браузерах добавь свой ключ OpenAI / Claude / Gemini или Ollama.',
    ],
  },
  {
    id: 'widgets', emoji: '🧩', title: 'Собрать свой дашборд', blurb: 'Виджеты перетаскиванием',
    steps: [
      'На главной нажми иконку замка (справа от приветствия) — включится редактор.',
      'Тащи и меняй размер виджетов. Плитка «+» открывает каталог виджетов.',
      'Ненужный виджет скрывается крестиком в его углу. «Готово» — сохранить.',
    ],
  },
  {
    id: 'screens', emoji: '🗂️', title: 'Несколько экранов', blurb: 'Как рабочие столы',
    steps: [
      'Над сеткой виджетов есть вкладки экранов и кнопка «+».',
      'Создай экран из шаблона (Работа, Здоровье…) или пустой — у каждого своя раскладка.',
      'Переименовать и удалить экран можно на активной вкладке.',
    ],
  },
  {
    id: 'focus', emoji: '🎯', title: 'Focus Mode', blurb: 'Помодоро, звуки, задачи',
    steps: [
      'Кнопка «Фокус» в шапке или Ctrl+Shift+F.',
      'Под кругом — задачи дня: добавляй, отмечай, меняй важность кликом по кружку.',
      'Кружки-иконки внизу: помидор/таймер, микшер звуков, YouTube, фон, статистика.',
      'Таймер и звук продолжаются даже после перезагрузки и в новой вкладке.',
    ],
  },
  {
    id: 'priority', emoji: '🔴', title: 'Важность задач', blurb: '5 цветов',
    steps: [
      'У каждой задачи есть цветной кружок важности.',
      'Клик по кружку — палитра: срочно (красный), высокий, обычный (зелёный), низкий, фоновая.',
      'Важность работает везде: в фокусе, в списке задач, на дашборде.',
    ],
  },
  {
    id: 'templates', emoji: '📦', title: 'Шаблоны плана', blurb: 'Быстрый старт',
    steps: [
      'Открой страницу «Шаблоны» (через палитру Ctrl+K → «Шаблоны»).',
      'Есть наборы под роли (студент, родитель, разработчик…) и под задачи (спорт, финансы).',
      'Применение добавит готовые цели, привычки и задачи — потом всё редактируется.',
    ],
  },
  {
    id: 'kanban', emoji: '📋', title: 'Канбан-доска', blurb: 'To do → В работе → Готово',
    steps: [
      'Страница «Задачи» → вкладка «Доска».',
      'Перетаскивай карточки между колонками стадий.',
      'Есть и доска по важности — вкладка «Приоритет».',
    ],
  },
  {
    id: 'wallpaper', emoji: '🌊', title: 'Живые обои', blurb: 'Видео как фон',
    steps: [
      'Включи стеклянную тему (Настройки → Оформление).',
      'Там же «Живые обои»: загрузи короткое видео (mp4/webm) или вставь ссылку YouTube.',
      'Фон оживёт; в Focus Mode можно поставить видео из плейлиста фоном.',
    ],
  },
  {
    id: 'sync', emoji: '🔗', title: 'Синхронизация', blurb: 'Между устройствами',
    steps: [
      'Всё хранится локально на устройстве — без облака.',
      'Настройки → экспорт/импорт: перенеси базу файлом (можно зашифровать паролем).',
      'QR-привязка переносит данные на телефон открытием ссылки.',
    ],
  },
  {
    id: 'plugins', emoji: '⚙️', title: 'Свои виджеты (плагины)', blurb: 'Контент из JSON',
    steps: [
      'Настройки → «Плагины»: загрузи JSON-плагин и он появится в каталоге виджетов.',
      'Так сделаны «Питание на месяц» и «Зарядка» — можно собрать свой контент-виджет.',
      'Формат описан в docs/plugins/GUIDE.md.',
    ],
  },
  {
    id: 'health', emoji: '❤️', title: 'Здоровье и калории', blurb: 'Питание, активность',
    steps: [
      'Виджеты «Калории», «Активность», «Зарядка 7 минут» на дашборде.',
      'Заполни профиль (пол, возраст, рост, вес) — посчитается базовый метаболизм и баланс дня.',
      'Отметки «съел» и зарядка автоматически двигают цели здоровья.',
    ],
  },
];

export const LearnModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [active, setActive] = useState<Topic | null>(null);

  useEffect(() => {
    if (!open) { setActive(null); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (active) setActive(null); else onClose(); } };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, active, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-surface relative z-10 w-full max-w-3xl max-h-[90vh] rounded-2xl bg-bg-card border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-soft shrink-0">
          {active ? (
            <button onClick={() => setActive(null)} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text shrink-0" title="Назад">
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <GraduationCap className="h-5 w-5 text-accent shrink-0" />
          )}
          <div className="text-sm font-semibold text-text flex-1 truncate">{active ? `${active.emoji} ${active.title}` : 'Обучение — как всё устроено'}</div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text shrink-0" title="Закрыть (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {active ? (
            <div className="max-w-xl">
              <p className="text-sm text-text-muted mb-4">{active.blurb}</p>
              <ol className="space-y-3">
                {active.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-accent/12 text-accent text-xs font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                    <span className="text-sm text-text leading-relaxed pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t)}
                  className="aspect-square rounded-xl border border-border-soft bg-bg-soft/40 hover:border-accent/50 hover:bg-accent/5 p-3 flex flex-col items-center justify-center text-center gap-1.5 transition-colors"
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-[12px] font-medium text-text leading-tight">{t.title}</span>
                  <span className="text-[10px] text-text-dim leading-tight">{t.blurb}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
