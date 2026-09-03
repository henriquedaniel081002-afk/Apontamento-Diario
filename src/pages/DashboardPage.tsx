import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageContainer, ProgressLoadingState } from '../components/common/ui';
import { MonthlyDashboard, type DashboardScope } from '../dashboard/dashboards/MonthlyDashboard';
import type { DashboardData } from '../dashboard/types';
import type { User } from '../types';
import { dashboardService } from '../services/dashboardService';
import { useLoadingProgress } from '../hooks/useLoadingProgress';
import '../dashboard/dashboard.css';

interface DashboardPageProps {
  user?: User;
}

function getUserDashboardScope(user?: User): DashboardScope | undefined {
  if (!user || user.perfil === 'COORDENACAO' || !user.setor) return undefined;

  if (user.setor === 'BOBINA AT/BT') {
    return { setores: ['BOBINA AT', 'BOBINA BT'], label: 'Bobinagem AT/BT' };
  }

  const setorMap: Partial<Record<NonNullable<User['setor']>, string>> = {
    'CORTE LASER': 'CORTE DO LASER',
    'MONTAGEM NUCLEO': 'MONTAGEM DO NUCLEO',
  };
  const setor = setorMap[user.setor] || user.setor;

  if (user.setor === 'EPOXI') {
    return { setores: ['EPOXI'], linhas: ['EPO'], label: 'Epóxi' };
  }

  if ((user.setor === 'MONTAGEM FINAL' || user.setor === 'MPA') && user.linhas.length === 1) {
    return {
      setores: [setor],
      linhas: [user.linhas[0]],
      label: `${setor === 'MONTAGEM FINAL' ? 'Montagem Final' : 'MPA'} ${user.linhas[0]}`,
    };
  }

  return { setores: [setor], label: setor };
}

export function DashboardPage({ user }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { progress, startProgress, completeProgress } = useLoadingProgress();
  const scope = useMemo(() => getUserDashboardScope(user), [user]);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    startProgress();
    try {
      setData(await dashboardService.getData(forceRefresh));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar a Aderência Mensal.');
    } finally {
      await completeProgress();
      setLoading(false);
    }
  }, [completeProgress, startProgress]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <PageContainer className="py-6 sm:py-8">
      <ProgressLoadingState
        progress={progress}
        label="Carregando Aderência Mensal"
        description="Buscando programação, produção e ocorrências aprovadas para montar os indicadores."
      />
    </PageContainer>;
  }

  if (error || !data) {
    return <PageContainer className="py-6 sm:py-8">
      <ErrorState
        title="Não foi possível carregar a Aderência Mensal"
        description={error || 'Dados indisponíveis.'}
        action={<Button onClick={() => void load(true)} leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}>Tentar novamente</Button>}
      />
    </PageContainer>;
  }

  if (!data.periodo.meses.length) {
    return <PageContainer className="py-6 sm:py-8">
      <EmptyState
        icon={<BarChart3 className="size-6" aria-hidden="true" />}
        title="Aderência Mensal pronta para receber a programação"
        description={user?.perfil === 'APONTADOR'
          ? 'Ainda não há programação disponível para a sua área. A Coordenação pode importar a BASE PROG na tela de Registros.'
          : 'Importe um mês da BASE PROG na tela de Registros da Coordenação. Os apontamentos realizados já serão cruzados automaticamente.'}
      />
    </PageContainer>;
  }

  return <MonthlyDashboard dados={data} scope={scope} />;
}
