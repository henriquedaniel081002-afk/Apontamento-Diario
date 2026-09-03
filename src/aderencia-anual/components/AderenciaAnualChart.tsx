import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnnualComparisonRow } from '../types';

const COLORS = ['#00c76f', '#60a5fa', '#fbbf24', '#c084fc', '#fb7185', '#22d3ee', '#a3e635', '#fb923c'];
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

interface AderenciaAnualChartProps {
  data: AnnualComparisonRow[];
  years: number[];
}

export function AderenciaAnualChart({ data, years }: AderenciaAnualChartProps) {
  const minimumWidth = Math.max(760, years.length * 170);

  return (
    <div className="min-w-0 overflow-x-auto" aria-label="Comparativo anual da quantidade realizada">
      <div style={{ minWidth: minimumWidth }}>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={data} margin={{ top: 34, right: 24, left: 8, bottom: 8 }} barGap={2} barCategoryGap="18%">
            <CartesianGrid stroke="rgba(196,255,222,0.08)" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={{ stroke: 'rgba(196,255,222,0.14)' }}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => compactFormatter.format(Number(value))}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
              width={58}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.035)' }}
              formatter={(value, name) => [numberFormatter.format(Number(value)), String(name)]}
              labelFormatter={(label) => `Mês: ${String(label)}`}
              contentStyle={{
                border: '1px solid rgba(196,255,222,0.14)',
                borderRadius: '12px',
                background: '#0c120e',
                color: '#f8fafc',
                boxShadow: '0 18px 45px rgba(0,0,0,.35)',
              }}
              labelStyle={{ color: '#cbd5e1', fontWeight: 800 }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: 18, color: '#cbd5e1', fontSize: 12, fontWeight: 700 }}
            />
            {years.map((year, index) => (
              <Bar
                key={year}
                dataKey={String(year)}
                name={String(year)}
                fill={COLORS[index % COLORS.length]}
                maxBarSize={34}
                radius={[5, 5, 0, 0]}
              >
                <LabelList
                  dataKey={String(year)}
                  position="top"
                  fill="#cbd5e1"
                  fontSize={10}
                  fontWeight={800}
                  formatter={(value: unknown) => value == null ? '' : numberFormatter.format(Number(value))}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
