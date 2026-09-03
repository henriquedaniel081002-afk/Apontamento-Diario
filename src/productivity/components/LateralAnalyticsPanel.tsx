import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Info } from 'lucide-react';
import { KPIStats } from '../types';
import { formatMinutesToHHMM, formatPercentage, formatNumberBR } from '../utils/calculations';

interface LateralAnalyticsPanelProps {
  stats: KPIStats;
  productivityTarget?: number;
}

export const LateralAnalyticsPanel: React.FC<LateralAnalyticsPanelProps> = ({ stats, productivityTarget = 95 }) => {
  // Line chart data
  const chartData = stats.dailyTrend || [];

  // Donut chart data: Tempo Produzido vs Tempo Parado
  const totalTrackedTime = stats.totalProducedMinutes + stats.totalStoppageMinutes;
  const producedShare = totalTrackedTime > 0 ? (stats.totalProducedMinutes / totalTrackedTime) * 100 : 0;
  const stoppageShare = totalTrackedTime > 0 ? (stats.totalStoppageMinutes / totalTrackedTime) * 100 : 0;

  const donutData = [
    { name: 'Tempo Produzido', minutes: stats.totalProducedMinutes, color: '#10b981' },
    { name: 'Tempo Parado', minutes: stats.totalStoppageMinutes, color: '#f97316' },
  ];

  // Custom Dark Tooltip for Line Chart
  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-[var(--surface-base)] border border-[var(--border-subtle)] p-2 rounded-lg shadow-xl text-xs font-mono">
          <div className="text-slate-400 font-sans text-[11px] mb-1 font-semibold">
            Data: <span className="text-slate-100">{dataPoint.formattedDate || label}</span>
          </div>
          <div className="text-emerald-400 font-bold text-sm mb-1 flex items-center justify-between gap-3">
            <span>Produtividade:</span>
            <span>{formatPercentage(dataPoint.productivity, 1)}</span>
          </div>
          <div className="text-slate-300 text-[10px] space-y-0.5 border-t border-[var(--border-subtle)] pt-1">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Tempo Produzido:</span>
              <span className="text-cyan-300">{formatMinutesToHHMM(dataPoint.producedMin)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Tempo Disponível:</span>
              <span className="text-slate-200">{formatMinutesToHHMM(dataPoint.availableMin)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Peças:</span>
              <span className="text-emerald-300">{formatNumberBR(dataPoint.pieces)} unid.</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <aside 
      id="lateral-analytics-panel"
      className="flex flex-col gap-3 w-full"
    >
      {/* 1. Evolução da Produtividade % */}
      <div className="analytics-card bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.26)]">
        <div className="flex items-center justify-between mb-2 border-b border-[var(--border-subtle)] pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Evolução da Produtividade %
              </h3>
              <p className="text-[10px] text-slate-400">Curva diária de eficiência e meta industrial</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Meta: {formatPercentage(productivityTarget, 0)}
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-36 2xl:h-40 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,255,222,0.10)" vertical={false} />
                <XAxis 
                  dataKey="formattedDate" 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(196,255,222,0.14)' }}
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10} 
                  domain={[40, 110]} 
                  tickFormatter={(val) => `${val}%`}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(196,255,222,0.14)' }}
                />
                <Tooltip content={<CustomLineTooltip />} />
                <ReferenceLine 
                  y={productivityTarget} 
                  stroke="#10b981" 
                  strokeDasharray="4 4" 
                  strokeOpacity={0.6}
                  label={{ value: `${productivityTarget}%`, fill: '#34d399', fontSize: 9, position: 'right' }} 
                />
                <Line
                  type="monotone"
                  dataKey="productivity"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#10b981', stroke: '#030605', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#34d399', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Sem dados suficientes no período
            </div>
          )}
        </div>
      </div>

      {/* 2. Distribuição do Tempo (Donut Chart) */}
      <div className="analytics-card bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.26)]">
        <div className="flex items-center justify-between mb-2 border-b border-[var(--border-subtle)] pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
              <PieIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Distribuição do Tempo
              </h3>
              <p className="text-[10px] text-slate-400">Tempo Produzido vs Tempo Parado</p>
            </div>
          </div>
        </div>

        {/* Donut chart + Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2">
          <div className="sm:col-span-6 h-28 2xl:h-32 relative flex items-center justify-center">
            {totalTrackedTime > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={46}
                    paddingAngle={3}
                    dataKey="minutes"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0a100d" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">0 min</div>
            )}
            
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-slate-400">Total</span>
              <span className="text-xs font-bold text-slate-100 font-mono">
                {formatMinutesToHHMM(totalTrackedTime)}
              </span>
            </div>
          </div>

          {/* Legends & Details */}
          <div className="sm:col-span-6 flex flex-col gap-2 text-xs">
            {/* Tempo Produzido */}
            <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] p-2 rounded-lg">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-300 font-medium">Produzido</span>
                </div>
                <span className="font-bold text-emerald-400 font-mono">{formatPercentage(producedShare, 1)}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {formatMinutesToHHMM(stats.totalProducedMinutes)} ({Math.round(stats.totalProducedMinutes)} min)
              </div>
            </div>

            {/* Tempo Parado */}
            <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] p-2 rounded-lg">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                  <span className="text-slate-300 font-medium">Parado</span>
                </div>
                <span className="font-bold text-orange-400 font-mono">{formatPercentage(stoppageShare, 1)}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {formatMinutesToHHMM(stats.totalStoppageMinutes)} ({Math.round(stats.totalStoppageMinutes)} min)
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center gap-1.5 text-[10px] text-slate-400">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Gráfico analítico. Não altera a fórmula de produtividade.</span>
        </div>
      </div>

    </aside>
  );
};
