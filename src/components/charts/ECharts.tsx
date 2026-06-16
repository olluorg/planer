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
  return (
    <ReactEChartsCore
      key={theme}
      echarts={echarts}
      option={{ backgroundColor: 'transparent', ...option }}
      style={{ height, width: '100%' }}
      className={className}
      notMerge
      lazyUpdate
      theme={theme === 'dark' ? 'dark' : undefined}
    />
  );
};
