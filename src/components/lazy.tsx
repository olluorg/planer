import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from 'react';

/** Ленивый компонент с именованным экспортом и заглушкой той же высоты.
 *  Место использования не меняется: <CaloriesWidget /> как был, так и остаётся. */
export function lazyNamed<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: ReactNode = null,
): ComponentType<P> {
  // Внутри типы ослабляем: React.lazy плохо выводит обобщённые пропсы, а
  // снаружи сигнатура ComponentType<P> всё равно проверяет места использования.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = lazy(() => load().then((C) => ({ default: C as ComponentType<any> })));
  const Wrapped = (props: P) => (
    <Suspense fallback={fallback}>
      <L {...props} />
    </Suspense>
  );
  return Wrapped;
}

/** Заглушка виджета на время загрузки — держит место, чтобы сетка не прыгала. */
export const WidgetSkeleton = ({ height = 160 }: { height?: number }) => (
  <div className="skeleton rounded-2xl w-full" style={{ height }} />
);

/** Монтирует содержимое при первом `on` и больше не размонтирует.
 *  Для окон, которые держат состояние и после закрытия: фокус-режим с идущим
 *  таймером потерял бы его при размонтировании. Код окна при этом
 *  загружается только когда его впервые открыли. */
export function MountOnce({ on, children }: { on: boolean; children: ReactNode }) {
  const [seen, setSeen] = useState(on);
  useEffect(() => { if (on) setSeen(true); }, [on]);
  return seen || on ? <Suspense fallback={null}>{children}</Suspense> : null;
}
