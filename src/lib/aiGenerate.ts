/** AI-генерация плана: из описания на естественном языке модель возвращает структуру
 *  «цель + задачи (+ привычки)». Работает через askAny (встроенный Chrome AI → свой ключ). */
import { askAny } from './aiProvider';
import type { GoalType, Recurrence } from './types';

export interface GenTask {
  title: string;
  priority: number;                // 1 срочно … 5 фоновая (по умолчанию 3)
  day_offset: number;              // 0 = сегодня, 1 = завтра …
  recurrence: Recurrence;
}
export interface GenHabit {
  title: string;
  schedule: 'daily' | 'weekly';
  target_per_week: number;
}
export interface GeneratedPlan {
  goal: { title: string; type: GoalType; metric: string | null; target_value: number | null; unit: string | null; deadline_days: number | null } | null;
  tasks: GenTask[];
  habits: GenHabit[];
}

const SYSTEM = `Ты — планировщик в приложении THEDAD. По запросу пользователя составь конкретный, выполнимый план.
Отвечай ТОЛЬКО валидным JSON без markdown-обёртки и пояснений, строго по схеме:
{
  "goal": { "title": string, "type": "long"|"mid"|"short", "metric": string|null, "target_value": number|null, "unit": string|null, "deadline_days": number|null } | null,
  "tasks": [ { "title": string, "priority": 1|2|3|4|5, "day_offset": number, "recurrence": "daily"|"weekdays"|"weekends"|"weekly"|null } ],
  "habits": [ { "title": string, "schedule": "daily"|"weekly", "target_per_week": number } ]
}
Правила: всё по-русски. 3–7 задач, конкретных и небольших. priority: 1 срочно, 2 высокий, 3 обычный, 4 низкий, 5 фоновая (по умолчанию 3). day_offset — через сколько дней от сегодня делать (0..30). type: long — годовые, mid — на месяцы, short — на недели. Если цель не подразумевается — goal=null. habits добавляй только если это уместно (регулярные действия). Никакого текста вне JSON.`;

/** Достаёт JSON из ответа модели (срезает markdown-заборы и лишний текст вокруг). */
function extractJson(raw: string): any {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

const RECS = new Set(['daily', 'weekdays', 'weekends', 'weekly']);
const clampPrio = (n: any): number => (Number.isInteger(n) && n >= 1 && n <= 5 ? n : 3);

/** Нормализуем «сырой» JSON модели в надёжную структуру (модель может врать по типам). */
function normalize(data: any): GeneratedPlan {
  const g = data?.goal;
  const goal = g && typeof g.title === 'string' && g.title.trim()
    ? {
        title: String(g.title).trim().slice(0, 120),
        type: (['long', 'mid', 'short'].includes(g.type) ? g.type : 'mid') as GoalType,
        metric: g.metric ? String(g.metric).slice(0, 40) : null,
        target_value: Number.isFinite(Number(g.target_value)) && Number(g.target_value) > 0 ? Number(g.target_value) : null,
        unit: g.unit ? String(g.unit).slice(0, 20) : null,
        deadline_days: Number.isFinite(Number(g.deadline_days)) && Number(g.deadline_days) > 0 ? Math.round(Number(g.deadline_days)) : null,
      }
    : null;

  const tasks: GenTask[] = Array.isArray(data?.tasks)
    ? data.tasks
        .filter((t: any) => t && typeof t.title === 'string' && t.title.trim())
        .slice(0, 12)
        .map((t: any) => ({
          title: String(t.title).trim().slice(0, 160),
          priority: clampPrio(Number(t.priority)),
          day_offset: Math.min(60, Math.max(0, Math.round(Number(t.day_offset)) || 0)),
          recurrence: (RECS.has(t.recurrence) ? t.recurrence : null) as Recurrence,
        }))
    : [];

  const habits: GenHabit[] = Array.isArray(data?.habits)
    ? data.habits
        .filter((h: any) => h && typeof h.title === 'string' && h.title.trim())
        .slice(0, 6)
        .map((h: any) => ({
          title: String(h.title).trim().slice(0, 120),
          schedule: (h.schedule === 'weekly' ? 'weekly' : 'daily') as 'daily' | 'weekly',
          target_per_week: Math.min(7, Math.max(1, Math.round(Number(h.target_per_week)) || 7)),
        }))
    : [];

  return { goal, tasks, habits };
}

/** Сгенерировать план по описанию. Бросает понятную ошибку, если AI недоступен/ответ не распарсился. */
export async function generatePlan(prompt: string, signal?: AbortSignal): Promise<GeneratedPlan> {
  const reply = await askAny([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt.trim().slice(0, 800) },
  ], signal);
  let data: any;
  try { data = extractJson(reply); }
  catch { throw new Error('Модель вернула ответ не в формате JSON — попробуй переформулировать запрос'); }
  const plan = normalize(data);
  if (!plan.goal && plan.tasks.length === 0 && plan.habits.length === 0) {
    throw new Error('Не удалось собрать план из ответа — попробуй ещё раз');
  }
  return plan;
}
