import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, HeatmapChart, PieChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, DatasetComponent,
  TitleComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent, CalendarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, LineChart, HeatmapChart, PieChart,
  GridComponent, TooltipComponent, LegendComponent, DatasetComponent,
  TitleComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent, CalendarComponent,
  CanvasRenderer,
]);

interface Props {
  option: any;
  height?: number | string;
  className?: string;
}

export const ECharts: React.FC<Props> = ({ option, height = 240, className }) => (
  <ReactEChartsCore
    echarts={echarts}
    option={option}
    style={{ height, width: '100%' }}
    className={className}
    notMerge
    lazyUpdate
    theme="dark"
  />
);
