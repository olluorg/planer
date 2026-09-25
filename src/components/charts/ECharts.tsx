import { lazy, Suspense } from 'react';
import type { EChartsProps } from './EChartsImpl';

/** Графики грузятся по требованию.
 *
 *  ECharts — 616 КБ, треть всего JavaScript приложения. Раньше этот чанк
 *  стоял в предзагрузке index.html и тянулся до первой отрисовки, даже если
 *  на экране ни одного графика. Теперь он приезжает, когда график впервые
 *  появляется, а до того на его месте заглушка той же высоты — без сдвига
 *  вёрстки. Все места использования импортируют ECharts отсюда, как и раньше. */
const Impl = lazy(() => import('./EChartsImpl'));

export const ECharts: React.FC<EChartsProps> = (props) => (
  <Suspense fallback={<div className="skeleton rounded-lg" style={{ height: props.height ?? 240, width: '100%' }} />}>
    <Impl {...props} />
  </Suspense>
);
