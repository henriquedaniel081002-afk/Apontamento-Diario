import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aderenciaAnualService } from './services/aderenciaAnualService';
import { AderenciaAnualPage } from './AderenciaAnualPage';



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

afterEach(cleanup);

beforeEach(() => {
  getAllMock.mockReset();
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
    expect(screen.getByRole('region', { name: 'Indicadores de 2025' })).not.toHaveTextContent('Aderência Anual');

    await user.click(screen.getByRole('combobox', { name: 'Ano' }));
    await user.click(screen.getByRole('option', { name: '2024' }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Indicadores de 2024' })).toHaveTextContent('90');
    });
    expect(screen.getByTestId('annual-chart-years')).toHaveTextContent('2024,2025');
    expect(getAllMock).toHaveBeenCalledTimes(1);
  });
});
