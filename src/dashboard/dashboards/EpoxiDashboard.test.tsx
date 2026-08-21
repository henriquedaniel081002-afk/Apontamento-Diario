// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { EpoxiDashboard } from './EpoxiDashboard';

afterEach(cleanup);

describe('EpoxiDashboard', () => {
  it('consolida apenas EPOXI/EPO, respeita o turno e abre o drawer diário', async () => {
    const user = userEvent.setup();

    render(
      <EpoxiDashboard
        mes="2024-02"
        turno="Primeiro"
        detalhes={[
          { data: '2024-02-01', setor: 'EPOXI', linha: 'EPO', potencia: 15, quantidade: 10 },
          { data: '2024-02-01', setor: 'EPOXI', linha: 'EPO', potencia: 25, quantidade: 5 },
          { data: '2024-02-02', setor: 'EPOXI', linha: 'EPO', potencia: 30, quantidade: 20 },
          { data: '2024-02-01', setor: 'EPOXI', linha: 'MON', potencia: 99, quantidade: 900 },
          { data: '2024-02-01', setor: 'MONTAGEM FINAL', linha: 'EPO', potencia: 88, quantidade: 800 },
        ]}
        faltas={[
          { data: '2024-02-01', setor: 'EPOXI', linha: 'EPO', turno: 'Primeiro', quantidade: 2 },
          { data: '2024-02-01', setor: 'EPOXI', linha: 'EPO', turno: 'Segundo', quantidade: 9 },
          { data: '2024-02-02', setor: 'EPOXI', linha: '', turno: 'Primeiro', quantidade: 1 },
        ]}
        observacoes={[
          { data: '2024-02-01', setor: 'EPOXI', linha: 'EPO', observacao: 'Ajuste da mistura' },
          { data: '2024-02-01', setor: 'EPOXI', linha: 'MON', observacao: 'Ignorar outra linha' },
        ]}
      />,
    );

    const productionKpi = screen.getByText('Produção total').closest('article');
    const daysKpi = screen.getByText('Dias com produção').closest('article');
    const absencesKpi = screen.getByText('Total de faltas').closest('article');
    const occurrencesKpi = screen.getByText('Total de ocorrências').closest('article');

    expect(productionKpi).not.toBeNull();
    expect(daysKpi).not.toBeNull();
    expect(absencesKpi).not.toBeNull();
    expect(occurrencesKpi).not.toBeNull();
    expect(within(productionKpi!).getByText('35')).toBeInTheDocument();
    expect(within(daysKpi!).getByText('2')).toBeInTheDocument();
    expect(within(absencesKpi!).getByText('3')).toBeInTheDocument();
    expect(within(occurrencesKpi!).getByText('1')).toBeInTheDocument();
    expect(within(absencesKpi!).getByText('Faltas do Primeiro turno')).toBeInTheDocument();

    const productionTable = screen.getByRole('region', { name: 'Detalhes de produção' });
    expect(within(productionTable).getAllByRole('row')).toHaveLength(4);
    expect(within(productionTable).queryByText('99 kVA')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Faltas' })).not.toHaveTextContent('Segundo turno');

    await user.click(
      screen.getByRole('button', {
        name: '2024-02-01: 15 unidades produzidas. Abrir detalhes.',
      }),
    );

    const dialog = screen.getByRole('dialog', { name: /01 de fevereiro de 2024/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.parentElement).toHaveAttribute('data-presentation', 'drawer');
    expect(dialog).toHaveTextContent('EPOXI • Linha EPO • Primeiro turno');
    expect(within(dialog).getByText('15 un.')).toBeInTheDocument();
    expect(within(dialog).getByText('15 kVA')).toBeInTheDocument();
    expect(within(dialog).getByText('25 kVA')).toBeInTheDocument();
    expect(within(dialog).queryByText('30 kVA')).not.toBeInTheDocument();
    const dailyAbsences = within(dialog).getByRole('heading', { name: 'Faltas do dia' }).closest('section');
    expect(dailyAbsences).not.toBeNull();
    expect(within(dailyAbsences!).getAllByText('2')).toHaveLength(2);
    expect(within(dialog).getByText('Ajuste da mistura')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('apresenta estados vazios e impede a abertura de dias sem produção', () => {
    render(<EpoxiDashboard mes="2024-02" turno="Todos" detalhes={[]} faltas={[]} observacoes={[]} />);

    expect(screen.getByText('Nenhum registro de produção no período.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma falta registrada no período.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma ocorrência registrada no período.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2024-02-01: 0 unidades produzidas' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
