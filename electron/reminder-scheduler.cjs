/** One timer per reminder; firing one must not cancel other reminders at the same time. */
function createReminderScheduler({ now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, notify }) {
  const timers = new Set();
  let generation = 0;
  function clear() {
    generation++;
    for (const timer of timers) clearTimer(timer);
    timers.clear();
  }
  function schedule(reminder, currentGeneration) {
    if (!reminder?.enabled || typeof reminder.time !== 'string' || typeof reminder.text !== 'string') return;
    const match = /^(\d{1,2}):(\d{2})$/.exec(reminder.time);
    if (!match) return;
    const hh = Number(match[1]), mm = Number(match[2]);
    if (hh > 23 || mm > 59) return;
    const current = now();
    const at = new Date(current);
    at.setHours(hh, mm, 0, 0);
    if (at.getTime() <= current) at.setDate(at.getDate() + 1);
    const timer = setTimer(() => {
      timers.delete(timer);
      if (currentGeneration !== generation) return;
      try { notify(reminder); } finally { schedule(reminder, currentGeneration); }
    }, at.getTime() - current);
    timers.add(timer);
  }
  function replace(reminders) {
    clear();
    if (Array.isArray(reminders)) reminders.forEach((reminder) => schedule(reminder, generation));
  }
  return { replace, clear };
}
module.exports = { createReminderScheduler };
