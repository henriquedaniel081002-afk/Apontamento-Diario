// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvolutionChart } from './Charts';

afterEach(cleanup);

describe('EvolutionChart', () => {
  it('expõe os valores do dia e abre o detalhamento por teclado', async () => {
    const user = userEvent.setup();
    const onDayClick = vi.fn();
    const item = { dia: '03', data: '2026-08-03', programado: 10, produzido: 12 };

    render(<EvolutionChart data={[item]} mesLabel="Agosto de 2026" onDayClick={onDayClick} />);

    const day = screen.getByRole('button', {
      name: /2026-08-03: programado 10, produzido 12, aderência 120\.00%\. abrir detalhes do dia/i,
    });
    day.focus();
    await user.keyboard('{Enter}');

    expect(onDayClick).toHaveBeenCalledWith(item);
    expect(day).toHaveFocus();
  });

  it('informa quando não há registros para os filtros', () => {
    render(<EvolutionChart data={[]} mesLabel="Agosto de 2026" />);

    expect(screen.getByRole('heading', { name: 'Evolução diária' })).toBeInTheDocument();
    expect(screen.getByText('Nenhum registro para exibir')).toBeInTheDocument();
  });
});
