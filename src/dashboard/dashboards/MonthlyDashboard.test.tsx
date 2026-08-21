// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EvolutionItem } from '../components/Charts';
import type { DashboardData } from '../types';
import { MonthlyDashboard } from './MonthlyDashboard';

vi.mock('../components/Charts', () => ({
  EvolutionChart: ({
    data,
    mesLabel,
    onDayClick,
  }: {
    data: EvolutionItem[];
    mesLabel: string;
    onDayClick?: (item: EvolutionItem) => void;
  }) => (
    <section aria-label="Gráfico mensal isolado">
      <span>{mesLabel}</span>
      <output data-testid="dados-grafico">{JSON.stringify(data)}</output>
      {data[0] && (
        <button type="button" onClick={() => onDayClick?.(data[0])}>
          Abrir primeiro dia
        </button>
      )}
    </section>
  ),
}));

vi.mock('../components/DayDetailModal', () => ({
  DayDetailModal: ({
    item,
    setor,
    linha,
    turno,
    onClose,
  }: {
    item: EvolutionItem;
    setor: string;
    linha: string;
    turno: string;
    onClose: () => void;
  }) => (
    <section aria-label="Detalhamento diário isolado">
      {item.data}|{setor}|{linha}|{turno}
      <button type="button" onClick={onClose}>Fechar detalhe isolado</button>
    </section>
  ),
}));

vi.mock('./EpoxiDashboard', () => ({
  EpoxiDashboard: ({ mes, turno }: { mes: string; turno: string }) => (
    <section aria-label="Painel EPOXI isolado">{mes}|{turno}</section>
  ),
}));

const dados: DashboardData = {
  geradoEm: '2024-03-01T12:00:00.000Z',
  periodo: { meses: ['2024-01', '2024-02'] },
  filtros: {
    linhas: ['MON', 'TRI'],
    setores: ['MONTAGEM FINAL', 'BOBINAGEM'],
    turnos: ['Primeiro', 'Segundo'],
  },
  programacao: [
    { data: '2024-02-01', linha: 'MON', setor: 'MONTAGEM FINAL', quantidade: 100 },
    { data: '2024-02-02', linha: 'TRI', setor: 'MONTAGEM FINAL', quantidade: 50 },
    { data: '2024-02-01', linha: 'MON', setor: 'BOBINAGEM', quantidade: 999 },
    { data: '2024-01-01', linha: 'MON', setor: 'MONTAGEM FINAL', quantidade: 700 },
  ],
  apontamento: [
    { data: '2024-02-01', linha: 'MON', setor: 'MONTAGEM FINAL', turno: 'Todos', quantidade: 120 },
    { data: '2024-02-02', linha: 'TRI', setor: 'MONTAGEM FINAL', turno: 'Todos', quantidade: 30 },
    { data: '2024-02-01', linha: 'MON', setor: 'BOBINAGEM', turno: 'Todos', quantidade: 888 },
  ],
  detalhesProducao: [],
  faltas: [],
  observacoes: [],
  detalhesFaltas: [],
  detalhesObservacoes: [],
  faltasMaterial: [],
  maquinasQuebradas: [],
  naoConformidades: [],
};

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(cleanup);

afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: originalScrollIntoView,
  });
});

function metricCard(name: string) {
  const card = screen.getByRole('heading', { name }).closest('article');
  if (!card) throw new Error(`Card da métrica "${name}" não encontrado.`);
  return within(card);
}

async function selectCustomOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(screen.getByRole('option', { name: option }));
}

describe('MonthlyDashboard', () => {
  it('consolida somente o período e filtros ativos e restaura os padrões', async () => {
    const user = userEvent.setup();
    render(<MonthlyDashboard dados={dados} />);

    expect(screen.getByRole('combobox', { name: 'Mês' })).toHaveTextContent('Fevereiro de 2024');
    expect(screen.getByRole('combobox', { name: 'Setor' })).toHaveTextContent('MONTAGEM FINAL');
    expect(metricCard('Aderência mensal').getByText('100,00%')).toHaveClass('positive');
    expect(metricCard('Média Programada').getByText('75,00')).toBeInTheDocument();
    expect(metricCard('Média Produzida').getByText('75,00')).toBeInTheDocument();
    expect(metricCard('Dias Úteis').getByText('2')).toBeInTheDocument();
    expect(metricCard('Produzido Parcial').getByText('150')).toBeInTheDocument();
    expect(metricCard('Programado Total').getByText('150')).toBeInTheDocument();
    expect(screen.getByTestId('dados-grafico')).toHaveTextContent('"programado":100,"produzido":120');
    expect(screen.getByTestId('dados-grafico')).toHaveTextContent('"programado":50,"produzido":30');

    const clear = screen.getByRole('button', { name: 'Limpar filtros' });
    expect(clear).toBeDisabled();

    await selectCustomOption(user, 'Linha', 'MON');

    expect(metricCard('Aderência mensal').getByText('120,00%')).toHaveClass('positive');
    expect(metricCard('Produzido Parcial').getByText('120')).toBeInTheDocument();
    expect(clear).toBeEnabled();

    await user.click(clear);

    expect(screen.getByRole('combobox', { name: 'Linha' })).toHaveTextContent('Todos');
    expect(metricCard('Aderência mensal').getByText('100,00%')).toHaveClass('positive');
    expect(clear).toBeDisabled();
  });

  it('abre o detalhe com o contexto atual e alterna para o painel EPOXI', async () => {
    const user = userEvent.setup();
    render(<MonthlyDashboard dados={dados} />);

    await selectCustomOption(user, 'Linha', 'MON');
    await user.click(screen.getByRole('button', { name: 'Abrir primeiro dia' }));

    expect(screen.getByRole('region', { name: 'Detalhamento diário isolado' })).toHaveTextContent(
      '2024-02-01|MONTAGEM FINAL|MON|Todos',
    );

    await user.click(screen.getByRole('button', { name: 'Fechar detalhe isolado' }));
    expect(screen.queryByRole('region', { name: 'Detalhamento diário isolado' })).not.toBeInTheDocument();

    await selectCustomOption(user, 'Setor', 'EPOXI');

    expect(screen.getByRole('combobox', { name: 'Linha' })).toHaveTextContent('EPO');
    expect(screen.getByRole('region', { name: 'Painel EPOXI isolado' })).toHaveTextContent(
      '2024-02|Todos',
    );
    expect(screen.queryByRole('region', { name: 'Gráfico mensal isolado' })).not.toBeInTheDocument();

    await selectCustomOption(user, 'Setor', 'MONTAGEM FINAL');
    expect(screen.getByRole('combobox', { name: 'Linha' })).toHaveTextContent('Todos');
    expect(within(screen.getByRole('region', { name: 'Gráfico mensal isolado' })).getByText('Fevereiro de 2024')).toBeInTheDocument();
  });
});
