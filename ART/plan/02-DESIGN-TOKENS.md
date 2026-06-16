# Дизайн-токены для внедрения

Извлечено из досок «Design System → Real Components» и «Data Visualization System».
Это то, чего сейчас не хватает на уровне фундамента.

## Цветовая шкала (Primary — Indigo/Violet)

```
primary-50:  #eef2ff
primary-100: #e0e7ff
primary-200: #c7d2fe
primary-300: #a5b4fc
primary-400: #818cf8
primary-500: #6366f1   ← accent (текущий)
primary-600: #4f46e5
primary-700: #4338ca
primary-800: #3730a3
primary-900: #312e81
```

## Neutral (Slate)

```
neutral-50:  #f8fafc
neutral-100: #f1f5f9
neutral-200: #e2e8f0
neutral-300: #cbd5e1
neutral-400: #94a3b8
neutral-500: #64748b
neutral-600: #475569
neutral-700: #334155
neutral-800: #1e293b
neutral-900: #0f172a
```

## Семантические (из Data Viz board)

```
success: #22c55e
warning: #f59e0b
danger:  #ef4444
info:    #3b82f6
neutral: #94a3b8
```

## Chart-палитра (для серий)

```
chart-1: #6366f1   chart-2: #8b5cf6   chart-3: #22c55e
chart-4: #f59e0b   chart-5: #ec4899   chart-6: #06b6d4
```

## Typography scale

| Токен | Размер/высота | Вес | Использование |
|---|---|---|---|
| Display | 56/64 | Bold | hero/landing |
| H1 | 32/40 | Semibold | заголовок страницы |
| H2 | 24/32 | Semibold | заголовок секции |
| H3 | 20/28 | Medium | заголовок карточки |
| Body | 16/24 | Regular | основной текст |
| Small | 14/20 | Regular | вторичный текст |
| Caption | 12/16 | Medium | подписи |
| Label | 12/16 | Mono/Medium | метки, UPPERCASE |

→ Внедрить как утилиты: `.text-display`, `.text-h1`…`.text-label`.

## Spacing scale

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128` (кратно 4).
Tailwind покрывает; задача — **ритм**: внутри карточки p-5, между карточками gap-6,
секции space-y-8.

## Radius

```
sm: 4px   md: 8px   lg: 12px   xl: 16px   2xl: 20px   full: 9999px
```
(уже внедрено — проверить применение: кнопки lg, карточки xl/2xl, чипы full.)

## Shadow

```
sm:   0 1px 2px rgba(15,23,42,.04)
md:   0 1px 3px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.06)   ← card
lg:   0 8px 28px rgba(99,102,241,.16)                               ← lift (accent)
xl:   0 20px 50px rgba(15,23,42,.12)                                ← модалки
```
(soft/card/lift уже есть — добавить xl для модалок.)

## Motion tokens

```
--motion-fast:   100ms
--motion-base:   150ms
--motion-slow:   300ms
--ease-standard:    cubic-bezier(0.4, 0, 0.2, 1)
--ease-emphasized:  cubic-bezier(0.22, 1, 0.36, 1)
--ease-decelerate:  cubic-bezier(0, 0, 0.2, 1)
--ease-accelerate:  cubic-bezier(0.4, 0, 1, 1)
```
+ уважать `prefers-reduced-motion` (отключать анимации).

## Backdrop / blur tokens (Overlay board)

```
blur-xs: 4px    blur-sm: 8px    blur-md: 16px    blur-lg: 24px    blur-xl: 40px
```

## Z-index слои (Overlay board)

```
0   base content
20  focus overlay
30  mobile sheet
40  command palette
50  side panel
60  modal/dialog
70  toast/notifications
```
(сейчас z-index расставлены вразнобой — свести к этой шкале.)

## Где внедрять

- `tailwind.config.js` — цветовые шкалы, shadow-xl, motion в theme.extend.
- `src/index.css` — CSS-переменные motion/blur, typography-утилиты, z-index sweep.
- Постепенно заменять хардкод-значения по компонентам.
