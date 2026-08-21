// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MetricPanels } from './MetricPanels';

afterEach(cleanup);

describe('MetricPanels', () => {
  it('apresenta as oito métricas e seus estados semânticos', () => {
    render(
      <MetricPanels
        adherence={{ value: '112,50%', trend: 'up' }}
        goal={{ value: '75,00%', percent: 75 }}
        auxiliary={{
          programmedAverage: '80,00',
          producedAverage: '90,00',
          producedAverageTrend: 'up',
          workingDays: '4',
        }}
        operational={{
          partialProgrammed: '320',
          partialProduced: '360',
          partialProducedTrend: 'up',
          totalProgrammed: '480',
        }}
      />,
    );

    const indicators = screen.getByRole('region', { name: 'Indicadores do período' });
    expect(within(indicators).getByRole('heading', { name: 'Aderência mensal' })).toBeInTheDocument();
    expect(within(indicators).getByText('112,50%')).toHaveClass('positive');
    expect(within(indicators).getByRole('heading', { name: 'Alcance de meta' })).toBeInTheDocument();
    expect(within(indicators).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');

    for (const label of [
      'Média Programada',
      'Média Produzida',
      'Dias Úteis',
      'Programado Parcial',
      'Produzido Parcial',
      'Programado Total',
    ]) {
      expect(within(indicators).getByRole('heading', { name: label })).toBeInTheDocument();
    }

    expect(within(indicators).getAllByText('Acima')).toHaveLength(3);
  });

  it('limita progressos inválidos e comunica tendência abaixo da meta', () => {
    const { container } = render(
      <MetricPanels
        adherence={{ value: '—', trend: 'down' }}
        goal={{ value: '145,00%', percent: 145 }}
        auxiliary={{
          programmedAverage: '100,00',
          producedAverage: '75,00',
          producedAverageTrend: 'down',
          workingDays: '2',
        }}
        operational={{
          partialProgrammed: '200',
          partialProduced: '150',
          partialProducedTrend: 'down',
          totalProgrammed: '400',
        }}
      />,
    );

    expect(screen.getByText('—')).toHaveClass('negative');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(container.querySelector('.control-scale__fill--blue')).toHaveStyle({ width: '100%' });
    expect(container.querySelector('.control-scale__fill--green')).toHaveStyle({ width: '0%' });
    expect(screen.getAllByText('Abaixo')).toHaveLength(3);
  });
});
