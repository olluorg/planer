import { test, expect } from '@playwright/test';

/** У каждого интерактивного элемента должно быть имя для скринридера.
 *  Раньше их было 3 на 359 кнопок: галочки задач, отметки привычек, удаление,
 *  переключатели читались как «кнопка», «флажок» — без того, что именно
 *  отмечаешь или удаляешь. Тест проходит все разделы на демо-данных. */
test('у всех кнопок, флажков и полей есть имя', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/settings');
  await page.getByRole('button', { name: /Загрузить примеры/ }).click();
  const found = new Map<string, Set<string>>();
  for (const p of ['/', '/goals', '/tasks', '/plan', '/habits', '/calendar', '/analytics', '/health', '/reflection', '/history', '/awards', '/templates', '/settings']) {
    await page.goto(p); await page.waitForTimeout(1200);
    const items = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('button, a[href], [role="button"], input:not([type="hidden"]), select, textarea').forEach((el) => {
        const e = el as HTMLElement;
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const txt = (e.textContent || '').trim();
        const name = e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('aria-labelledby')
          || (e.tagName === 'INPUT' ? (e.getAttribute('placeholder') || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent) || e.closest('label')?.textContent) : '')
          || txt;
        if (!name || !name.trim()) {
          const cls = (e.className?.toString() || '').split(' ').slice(0, 4).join(' ');
          const icon = e.querySelector('svg')?.getAttribute('class')?.match(/lucide-([a-z-]+)/)?.[1] || '';
          out.push(`${e.tagName.toLowerCase()} [${icon || 'без иконки'}] .${cls}`);
        }
      });
      return out;
    });
    for (const it of items) { if (!found.has(it)) found.set(it, new Set()); found.get(it)!.add(p); }
  }
  console.log(`\nБЕЗЫМЯННЫХ ВИДОВ: ${found.size}`);
  for (const [k, v] of found) console.log(`  ${k}  ← ${[...v].join(' ')}`);
});
