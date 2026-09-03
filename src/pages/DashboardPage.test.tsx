// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '../dashboard/types';
import { dashboardService } from '../services/dashboardService';
import { DashboardPage } from './DashboardPage';

vi.mock('../services/dashboardService', () => ({
  dashboardService: { getData: vi.fn() },
}));

vi.mock('../dashboard/dashboards/MonthlyDashboard', () => ({
  MonthlyDashboard: ({ dados }: { dados: DashboardData }) => (
    <section aria-label="Painel mensal carregado">{dados.geradoEm}</section>
  ),
}));

const createData = (meses: string[] = ['2024-02']): DashboardData => ({
  geradoEm: '2024-02-29T12:00:00.000Z',
  periodo: { meses },
  filtros: { linhas: ['MON'], setores: ['MONTAGEM FINAL'], turnos: ['Primeiro'] },
  programacao: [],
  apontamento: [],
  detalhesProducao: [],
  faltas: [],
  observacoes: [],
  detalhesFaltas: [],
  detalhesObservacoes: [],
  faltasMaterial: [],
  maquinasQuebradas: [],
  naoConformidades: [],
});

const getDataMock = vi.mocked(dashboardService.getData);

afterEach(cleanup);

beforeEach(() => {
  getDataMock.mockReset();
});

describe('DashboardPage', () => {
  it('comunica o carregamento enquanto a consulta está pendente', () => {
    getDataMock.mockReturnValue(new Promise<DashboardData>(() => undefined));

    render(<DashboardPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando Aderência Mensal');
  });

  it('renderiza o painel mensal quando a consulta termina com dados', async () => {
    getDataMock.mockResolvedValue(createData());

    render(<DashboardPage />);

    expect(await screen.findByRole('region', { name: 'Painel mensal carregado' })).toHaveTextContent(
      '2024-02-29T12:00:00.000Z',
    );
    expect(getDataMock).toHaveBeenCalledTimes(1);
  });

  it('exibe a orientação de vazio quando não existe programação mensal', async () => {
    getDataMock.mockResolvedValue(createData([]));

    render(<DashboardPage />);

    expect(
      await screen.findByRole('heading', { name: 'Aderência Mensal pronta para receber a programação' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Importe um mês da BASE PROG/i)).toBeInTheDocument();
  });

  it('expõe o erro e permite tentar novamente sem recarregar a página', async () => {
    const user = userEvent.setup();
    getDataMock
      .mockRejectedValueOnce(new Error('Falha controlada da API'))
      .mockResolvedValueOnce(createData());

    render(<DashboardPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Falha controlada da API');

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Painel mensal carregado' })).toBeInTheDocument();
    });
    expect(getDataMock).toHaveBeenCalledTimes(2);
  });
});
