// Парсер .ics (iCalendar) → события для импорта в задачи.
// Поддерживает VEVENT: SUMMARY, DTSTART (date / date-time), unfold строк.

export interface IcsEvent {
  title: string;
  date: string;       // YYYY-MM-DD
  start_time: string | null; // HH:MM или null (весь день)
}

function unfold(raw: string): string[] {
  // Строки .ics переносятся с ведущим пробелом/табом — склеиваем обратно.
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** '20260709' | '20260709T143000Z' | '2026-07-09' → {date, time} */
function parseDt(value: string): { date: string; time: string | null } | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const time = m[4] && m[5] ? `${m[4]}:${m[5]}` : null;
  return { date, time };
}

export function parseIcs(raw: string): IcsEvent[] {
  const lines = unfold(raw);
  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { cur = {}; continue; }
    if (line.startsWith('END:VEVENT')) {
      if (cur?.title && cur.date) events.push({ title: cur.title, date: cur.date, start_time: cur.start_time ?? null });
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).split(';')[0].toUpperCase();
    const val = line.slice(idx + 1);
    if (key === 'SUMMARY') cur.title = val.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ').trim();
    else if (key === 'DTSTART') {
      const dt = parseDt(val);
      if (dt) { cur.date = dt.date; cur.start_time = dt.time; }
    }
  }
  return events;
}
