import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { MonthlyDashboard } from '../dashboard/dashboards/MonthlyDashboard';
import type { DashboardData } from '../dashboard/types';
import { dashboardService } from '../services/dashboardService';
import '../dashboard/dashboard.css';

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardService.getData());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar o dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center gap-3 px-4 text-slate-400">
      <Loader2 className="size-7 animate-spin text-emerald-300" />
      <p className="text-sm font-bold">Carregando Programado x Produzido…</p>
    </div>;
  }

  if (error || !data) {
    return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <section className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-8 text-center">
        <AlertCircle className="mx-auto size-9 text-rose-300" />
        <h1 className="mt-3 text-lg font-black text-white">Não foi possível carregar o Dashboard de Aderência</h1>
        <p className="mt-2 text-sm text-slate-400">{error || 'Dados indisponíveis.'}</p>
        <button type="button" onClick={() => void load()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-[#041007] hover:bg-emerald-300">
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      </section>
    </div>;
  }

  if (!data.periodo.meses.length) {
    return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <section className="rounded-2xl border border-white/10 bg-[#0D120F] p-8 text-center">
        <BarChart3 className="mx-auto size-9 text-emerald-300" />
        <h1 className="mt-3 text-lg font-black text-white">Dashboard pronto para receber a programação</h1>
        <p className="mt-2 text-sm text-slate-400">Importe um mês da BASE PROG na tela de Registros da Coordenação. Os apontamentos realizados já serão cruzados automaticamente.</p>
      </section>
    </div>;
  }

  return <MonthlyDashboard dados={data} />;
}
