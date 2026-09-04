import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardService } from '../services/dashboardService';
import { aderenciaAnualService } from './services/aderenciaAnualService';
import { AderenciaAnualPage } from './AderenciaAnualPage';


vi.mock('../services/dashboardService', () => ({
  dashboardService: {
    getData: vi.fn(),
  },
}));

vi.mock('./services/aderenciaAnualService', () => ({
  aderenciaAnualService: {
    getAll: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('./components/AderenciaAnualChart', () => ({
  AderenciaAnualChart: ({ years }: { years: number[] }) => (
    <div data-testid="annual-chart-years">{years.join(',')}</div>
  ),
}));

const getAllMock = vi.mocked(aderenciaAnualService.getAll);
const getDashboardDataMock = vi.mocked(dashboardService.getData);

afterEach(cleanup);

beforeEach(() => {
  getAllMock.mockReset();
  getDashboardDataMock.mockReset();
  getDashboardDataMock.mockResolvedValue({
    geradoEm: '2026-09-04T12:00:00.000Z',
    periodo: { meses: ['2026-09'] },
    filtros: { linhas: ['MON', 'TRI'], setores: ['MONTAGEM FINAL'], turnos: ['1', '2'] },
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
  getAllMock.mockResolvedValue([
    { mes: '2024-01-01', programado: 100, realizado: 90, dias_uteis: 20 },
    { mes: '2025-01-01', programado: 200, realizado: 200, dias_uteis: 22 },
  ]);
});

describe('AderenciaAnualPage', () => {
  it('altera somente os cartões quando o ano é trocado e mantém todos os anos no gráfico', async () => {
    const user = userEvent.setup();
    render(<AderenciaAnualPage />);

    expect(await screen.findByRole('heading', { name: 'Comparativo Anual' })).toBeInTheDocument();
    expect(screen.getByTestId('annual-chart-years')).toHaveTextContent('2024,2025');
    expect(screen.getByRole('region', { name: 'Indicadores de 2025' })).toHaveTextContent('200');

    await user.click(screen.getByRole('combobox', { name: 'Ano' }));
    await user.click(screen.getByRole('option', { name: '2024' }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Indicadores de 2024' })).toHaveTextContent('90');
    });
    expect(screen.getByTestId('annual-chart-years')).toHaveTextContent('2024,2025');
    expect(getAllMock).toHaveBeenCalledTimes(1);
  });
});
