export interface ChartColors {
  axis: string;
  axisLine: string;
  splitLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  emptyBar: string;
  heatmapEmpty: string;
}

export function getChartColors(isDark: boolean): ChartColors {
  return isDark ? {
    axis: '#a3a3a3',
    axisLine: '#262626',
    splitLine: '#1f1f1f',
    tooltipBg: '#141414',
    tooltipBorder: '#262626',
    tooltipText: '#fafafa',
    emptyBar: '#2d2d2d',
    heatmapEmpty: '#1a1a1a',
  } : {
    axis: '#71717a',
    axisLine: '#d4d4d8',
    splitLine: '#f0f0f0',
    tooltipBg: '#ffffff',
    tooltipBorder: '#d4d4d8',
    tooltipText: '#09090b',
    emptyBar: '#e4e4e7',
    heatmapEmpty: '#f4f4f5',
  };
}
