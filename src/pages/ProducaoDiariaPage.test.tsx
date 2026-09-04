import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { producaoDiariaService } from '../services/producaoDiariaService';
import { ProducaoDiariaPage } from './ProducaoDiariaPage';

vi.mock('../services/producaoDiariaService', () => ({
  producaoDiariaService: { getData: vi.fn() },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  LabelList: () => null,
}));

const getDataMock = vi.mocked(producaoDiariaService.getData);

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Produção Diária', () => {
  it('exibe totais ponderados e todos os setores retornados para o período', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-09-04T12:00:00.000Z',
      filtros: { linhas: ['MON', 'TRI'] },
      setores: [
        { setor: 'BOBINAGEM', programado: 100, produzido: 100 },
        { setor: 'PINTURA', programado: 300, produzido: 150 },
      ],
    });

    render(<ProducaoDiariaPage />);

    expect(await screen.findByText('BOBINAGEM')).toBeInTheDocument();
    expect(screen.getByText('PINTURA')).toBeInTheDocument();
    expect(screen.getByText('400 unidades')).toBeInTheDocument();
    expect(screen.getByText('250 unidades')).toBeInTheDocument();
    expect(screen.getByText('62,50%')).toBeInTheDocument();
    expect(getDataMock).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'ALL');
  });

  it('refaz a consulta ao selecionar uma linha específica', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-09-04T12:00:00.000Z',
      filtros: { linhas: ['MON', 'TRI'] },
      setores: [{ setor: 'SOLDA', programado: 20, produzido: 20 }],
    });
    const user = userEvent.setup();

    render(<ProducaoDiariaPage />);
    await screen.findByText('SOLDA');
    await user.click(screen.getByRole('combobox', { name: 'Linha' }));
    await user.click(screen.getByRole('option', { name: 'MON' }));

    await waitFor(() => {
      expect(getDataMock).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), 'MON');
    });
  });
});
