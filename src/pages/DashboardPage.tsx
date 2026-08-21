import { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button, EmptyState, ErrorState, LoadingState, PageContainer } from '../components/common/ui';
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
    return <PageContainer className="py-6 sm:py-8">
      <LoadingState label="Carregando Programado x Produzido…" />
    </PageContainer>;
  }

  if (error || !data) {
    return <PageContainer className="py-6 sm:py-8">
      <ErrorState
        title="Não foi possível carregar o Dashboard de Aderência"
        description={error || 'Dados indisponíveis.'}
        action={<Button onClick={() => void load()} leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}>Tentar novamente</Button>}
      />
    </PageContainer>;
  }

  if (!data.periodo.meses.length) {
    return <PageContainer className="py-6 sm:py-8">
      <EmptyState
        icon={<BarChart3 className="size-6" aria-hidden="true" />}
        title="Dashboard pronto para receber a programação"
        description="Importe um mês da BASE PROG na tela de Registros da Coordenação. Os apontamentos realizados já serão cruzados automaticamente."
      />
    </PageContainer>;
  }

  return <MonthlyDashboard dados={data} />;
}
