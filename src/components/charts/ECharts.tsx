import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, HeatmapChart, PieChart, RadarChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, DatasetComponent,
  TitleComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent, CalendarComponent,
  RadarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, LineChart, HeatmapChart, PieChart, RadarChart,
  GridComponent, TooltipComponent, LegendComponent, DatasetComponent,
  TitleComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent, CalendarComponent,
  RadarComponent,
  CanvasRenderer,
]);

interface Props {
  option: any;
  height?: number | string;
  className?: string;
}

import { useTheme } from '@/lib/theme';

export const ECharts: React.FC<Props> = ({ option, height = 240, className }) => {
  const { theme } = useTheme();
  // Безопасность: тултипы рисуем через richText (canvas), а не HTML — чтобы
  // пользовательские/импортированные названия (цели, привычки) не могли внедрить
  // разметку в тултип (закрывает класс echarts XSS независимо от версии).
  const safe = { backgroundColor: 'transparent', ...option };
  if (safe.tooltip) {
    safe.tooltip = Array.isArray(safe.tooltip)
      ? safe.tooltip.map((t: any) => ({ renderMode: 'richText', ...t }))
      : { renderMode: 'richText', ...safe.tooltip };
  }
  return (
    <ReactEChartsCore
      key={theme}
      echarts={echarts}
      option={safe}
      style={{ height, width: '100%' }}
      className={className}
      notMerge
      lazyUpdate
      theme={theme === 'dark' ? 'dark' : undefined}
    />
  );
};
