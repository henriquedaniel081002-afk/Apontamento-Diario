import React from 'react';
import { AlertTriangle, Boxes, CalendarX2, Clock, TrendingUp, Zap } from 'lucide-react';
import { KPIStats } from '../types';
import { formatNumberBR, formatPercentage } from '../utils/calculations';

interface KpiCardsProps {
  stats: KPIStats;
  productivityTarget?: number;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ stats, productivityTarget = 95 }) => {
  const productivityTone = stats.productivityPercent >= productivityTarget
    ? { card: 'border-emerald-400/75', text: 'text-emerald-300', icon: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40', line: '#34d399', glow: 'shadow-[0_0_18px_rgba(16,185,129,0.16)]', dot: 'bg-emerald-400', divider: 'border-emerald-500/20', reference: 'rgba(52,211,153,0.28)' }
    : stats.productivityPercent >= 80
      ? { card: 'border-amber-400/75', text: 'text-amber-300', icon: 'bg-amber-500/15 text-amber-300 border-amber-400/40', line: '#fbbf24', glow: 'shadow-[0_0_18px_rgba(251,191,36,0.14)]', dot: 'bg-amber-400', divider: 'border-amber-500/20', reference: 'rgba(251,191,36,0.28)' }
      : { card: 'border-red-400/75', text: 'text-red-300', icon: 'bg-red-500/15 text-red-300 border-red-400/40', line: '#f87171', glow: 'shadow-[0_0_18px_rgba(248,113,113,0.14)]', dot: 'bg-red-400', divider: 'border-red-500/20', reference: 'rgba(248,113,113,0.28)' };

  const generateSparklinePoints = () => {
    if (!stats.dailyTrend?.length) return '0,16 30,16 60,16 90,16 120,16 150,16 180,16';
    const points = stats.dailyTrend.slice(-10);
    const minVal = Math.min(...points.map((p) => p.productivity), 60);
    const maxVal = Math.max(...points.map((p) => p.productivity), 105);
    const width = 180;
    const height = 22;
    const padding = 2;
    return points.map((p, idx) => {
      const x = (idx / (points.length - 1 || 1)) * width;
      const normalized = (p.productivity - minVal) / (maxVal - minVal || 1);
      const y = height - padding - normalized * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const baseCard = 'kpi-card group relative bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-[1.15rem] p-2.5 flex flex-col justify-between transition-colors shadow-[0_3px_12px_rgba(0,0,0,0.22)] min-h-[104px]';

  return (
    <section id="kpi-cards-grid" className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <div id="card-pecas-produzidas" className={`${baseCard} hover:border-emerald-500/45`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Peças produzidas</span>
            <div className="p-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-500/25"><Boxes className="w-3.5 h-3.5" /></div>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl 2xl:text-2xl font-extrabold text-emerald-400 font-mono tracking-tight">{formatNumberBR(stats.totalConvertedPieces, 0)}</span>
            <span className="text-[9px] text-slate-500">unid.</span>
          </div>
          <div className="pt-1.5 mt-1.5 border-t border-[var(--border-subtle)] text-[9px] text-slate-500 flex justify-between gap-2">
            <span>Bruto: <strong className="text-slate-300 font-mono">{formatNumberBR(stats.totalRawPieces)}</strong></span>
            <span className="text-emerald-400">Fator aplicado</span>
          </div>
        </div>

        <div id="card-tempo-disponivel" className={`${baseCard} hover:border-cyan-500/45`}>
          <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Tempo disponível</span><div className="p-1 rounded-md bg-cyan-950/60 text-cyan-400 border border-cyan-500/25"><Clock className="w-3.5 h-3.5" /></div></div>
          <div className="flex items-baseline gap-1 mt-1"><span className="text-xl 2xl:text-2xl font-extrabold text-cyan-300 font-mono tracking-tight">{formatNumberBR(Math.round(stats.totalAvailableMinutes))}</span><span className="text-[9px] text-slate-500 font-mono">min</span></div>
          <div className="pt-1.5 mt-1.5 border-t border-[var(--border-subtle)] text-[9px] text-slate-500 flex justify-between gap-2"><span>Seg-Qui 424m • Sex 389m</span><span className="text-cyan-400">+ H.E.</span></div>
        </div>

        <div id="card-tempo-produzido" className={`${baseCard} hover:border-teal-500/45`}>
          <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Tempo produzido</span><div className="p-1 rounded-md bg-teal-950/60 text-teal-300 border border-teal-500/25"><Zap className="w-3.5 h-3.5" /></div></div>
          <div className="flex items-baseline gap-1 mt-1"><span className="text-xl 2xl:text-2xl font-extrabold text-teal-300 font-mono tracking-tight">{formatNumberBR(Math.round(stats.totalProducedMinutes))}</span><span className="text-[9px] text-slate-500 font-mono">min</span></div>
          <div className="pt-1.5 mt-1.5 border-t border-[var(--border-subtle)] text-[9px] text-slate-500"><span>Minutos efetivamente produzidos</span></div>
        </div>

        <div id="card-produtividade-principal" className={`kpi-card relative bg-gradient-to-b from-[rgba(14,23,18,.99)] to-[rgba(7,12,9,.99)] border-2 ${productivityTone.card} rounded-[1.15rem] p-2.5 flex flex-col justify-between ${productivityTone.glow} overflow-hidden min-h-[104px]`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5"><span className={`text-[10px] font-bold tracking-wider uppercase ${productivityTone.text}`}>Produtividade %</span><span className={`w-1.5 h-1.5 rounded-full ${productivityTone.dot}`} /></div>
            <div className={`p-1 rounded-md border ${productivityTone.icon}`}><TrendingUp className="w-3.5 h-3.5" /></div>
          </div>
          <div className={`text-2xl 2xl:text-[28px] font-black font-mono tracking-tight ${productivityTone.text}`}>{formatPercentage(stats.productivityPercent, 2)}</div>
          <div className={`pt-1 mt-1 border-t ${productivityTone.divider}`}>
            <div className="flex items-center justify-between text-[8px] text-slate-500"><span>Evolução diária</span><span>Meta {formatPercentage(productivityTarget, 0)}</span></div>
            <div className="w-full h-[18px] overflow-hidden">
              <svg viewBox="0 0 180 22" className="w-full h-full overflow-visible"><line x1="0" y1="9" x2="180" y2="9" stroke={productivityTone.reference} strokeDasharray="3 3" strokeWidth="1" /><polyline fill="none" stroke={productivityTone.line} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={generateSparklinePoints()} /></svg>
            </div>
          </div>
        </div>

        <div id="card-tempo-parado" className={`${baseCard} hover:border-orange-500/45`}>
          <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Tempo parado</span><div className="p-1 rounded-md bg-orange-950/60 text-orange-400 border border-orange-500/25"><AlertTriangle className="w-3.5 h-3.5" /></div></div>
          <div className="flex items-baseline gap-1 mt-1"><span className="text-xl 2xl:text-2xl font-extrabold text-orange-400 font-mono tracking-tight">{formatNumberBR(Math.round(stats.totalStoppageMinutes))}</span><span className="text-[9px] text-slate-500 font-mono">min</span></div>
          <div className="pt-1.5 mt-1.5 border-t border-[var(--border-subtle)] text-[9px] text-slate-500"><span>Manutenção e outras paradas</span></div>
        </div>

        <div id="card-faltas" className={`${baseCard} hover:border-violet-500/45`}>
          <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Faltas</span><div className="p-1 rounded-md bg-violet-950/60 text-violet-300 border border-violet-500/25"><CalendarX2 className="w-3.5 h-3.5" /></div></div>
          <div className="flex items-baseline gap-1 mt-1"><span className="text-xl 2xl:text-2xl font-extrabold text-violet-300 font-mono tracking-tight">{formatNumberBR(stats.totalAbsences)}</span><span className="text-[9px] text-slate-500">faltas</span></div>
          <div className="pt-1.5 mt-1.5 border-t border-[var(--border-subtle)] text-[9px] text-slate-500"><span>Desde a 1ª produção de cada matrícula</span></div>
        </div>
      </div>
    </section>
  );
};
