import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { producaoDiariaService } from '../services/producaoDiariaService';
import { ApiError } from '../services/apiClient';
import { previousLocalDate } from '../producao-diaria/observacoes';
import { ProducaoDiariaPage } from './ProducaoDiariaPage';

vi.mock('../services/producaoDiariaService', () => ({
  producaoDiariaService: { getData: vi.fn(), getObservacoes: vi.fn(), saveObservacao: vi.fn(), getAcoes: vi.fn(), getAcao: vi.fn(), createAcao: vi.fn(), updateAcao: vi.fn(), getAcaoHistorico: vi.fn() },
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

const { renderMonthly } = vi.hoisted(() => ({ renderMonthly: vi.fn() }));
vi.mock('./DashboardPage', () => ({
  DashboardPage: (props: unknown) => {
    renderMonthly(props);
    return <div>Conteúdo mensal compartilhado</div>;
  },
}));

async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, label: string) {
  await user.click(trigger);
  await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: label }));
}
const getAcoesMock = vi.mocked(producaoDiariaService.getAcoes);
const createAcaoMock = vi.mocked(producaoDiariaService.createAcao);
const getDataMock = vi.mocked(producaoDiariaService.getData);
const getObservacoesMock = vi.mocked(producaoDiariaService.getObservacoes);
const saveObservacaoMock = vi.mocked(producaoDiariaService.saveObservacao);

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Produção Diária', () => {
  beforeEach(() => {
    getObservacoesMock.mockResolvedValue([]);
    getAcoesMock.mockResolvedValue({ acoes: [], proximoCursor: null });
  });
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
    expect(screen.getByRole('heading', { name: 'PINTURA' })).toBeInTheDocument();
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
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'MON' }));

    await waitFor(() => {
      expect(getDataMock).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), 'MON');
    });
  });

  it('mostra círculos individuais de MON, TRI e EPO no mesmo cartão e destaca a pendência', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON', 'TRI', 'EPO'] },
      setores: [{ setor: 'BOBINA AT', programado: 100, produzido: 100, linhas: [
        { linha: 'MON', programado: 40, produzido: 50, potencias: [] },
        { linha: 'TRI', programado: 40, produzido: 30, potencias: [] },
        { linha: 'EPO', programado: 20, produzido: 20, potencias: [] },
      ] }],
    });

    render(<ProducaoDiariaPage />);
    const card = await screen.findByRole('article', { name: 'Produção de BOBINA AT' });
    expect(card).toHaveTextContent('Linha abaixo do programado');
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
    expect(within(card).getAllByRole('img', { name: /Aderência da linha/ })).toHaveLength(3);
    const mon = within(card).getByRole('group', { name: 'Linha MON' });
    const tri = within(card).getByRole('group', { name: 'Linha TRI' });
    const epo = within(card).getByRole('group', { name: 'Linha EPO' });
    expect(within(mon).getByRole('img', { name: 'Aderência da linha MON: 125,00%' })).toBeInTheDocument();
    expect(within(tri).getByRole('img', { name: 'Aderência da linha TRI: 75,00%' })).toBeInTheDocument();
    expect(tri).toHaveTextContent('40');
    expect(tri).toHaveTextContent('30');
    expect(within(epo).getByRole('img', { name: 'Aderência da linha EPO: 100,00%' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Prog. 100 · Prod. 100');
    expect(within(card).queryByRole('img', { name: /Aderência do setor/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('100 unidades')).toHaveLength(2);
  });

  it('mostra apenas um círculo se a consulta retornar uma linha, mantendo detalhes e total', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON'] },
      setores: [{ setor: 'SOLDA', programado: 15, produzido: 18, linhas: [
        { linha: 'MON', programado: 15, produzido: 18, potencias: [] },
      ] }],
    });
    render(<ProducaoDiariaPage />);
    const card = await screen.findByRole('article', { name: 'Produção de SOLDA' });
    expect(within(card).getAllByRole('img', { name: /Aderência da linha/ })).toHaveLength(1);
    expect(within(card).getByRole('img', { name: 'Aderência da linha MON: 120,00%' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Prog. 15 · Prod. 18');
    expect(within(card).getByRole('button', { name: 'Ver detalhes de SOLDA' })).toBeInTheDocument();
  });

  it('exibe círculo neutro sem percentual quando linha não possui programação', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['EPO'] },
      setores: [{ setor: 'EPOXI', programado: 0, produzido: 5, linhas: [
        { linha: 'EPO', programado: 0, produzido: 5, potencias: [] },
      ] }],
    });
    render(<ProducaoDiariaPage />);
    const card = await screen.findByRole('article', { name: 'Produção de EPOXI' });
    expect(within(card).getByRole('img', { name: 'Aderência da linha EPO: sem programação' })).toBeInTheDocument();
    expect(within(card).getByText('—')).toBeInTheDocument();
    expect(card).toHaveTextContent('Prog. 0 · Prod. 5');
    expect(within(card).queryByRole('img', { name: /Aderência do setor/ })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: 'Visão por setor' }));
    expect(within(card).getByRole('img', { name: 'Aderência do setor EPOXI: sem programação' })).toBeInTheDocument();
  });

  it('mantém total e detalhes acessíveis quando a API ainda não fornece linhas', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON'] },
      setores: [{ setor: 'PINTURA', programado: 10, produzido: 4 }],
    });
    render(<ProducaoDiariaPage />);
    const card = await screen.findByRole('article', { name: 'Produção de PINTURA' });
    expect(within(card).queryByRole('img', { name: /Aderência da linha/ })).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Detalhamento por linha indisponível.');
    expect(card).toHaveTextContent('Prog. 10 · Prod. 4');
    expect(within(card).getByRole('button', { name: 'Ver detalhes de PINTURA' })).toBeInTheDocument();
  });

  it('alterna entre círculos por linha e a aderência consolidada ponderada do setor', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON', 'TRI'] },
      setores: [{ setor: 'BOBINA AT', programado: 215, produzido: 79, linhas: [
        { linha: 'MON', programado: 140, produzido: 42, potencias: [] },
        { linha: 'TRI', programado: 75, produzido: 37, potencias: [] },
      ] }],
    });
    render(<ProducaoDiariaPage />);
    const card = await screen.findByRole('article', { name: 'Produção de BOBINA AT' });
    expect(within(card).getByRole('img', { name: 'Aderência da linha MON: 30,00%' })).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'Aderência da linha TRI: 49,33%' })).toBeInTheDocument();
    const resumo = within(card).getByRole('region', { name: 'Total do setor BOBINA AT' });
    expect(resumo).toHaveTextContent('Prog. 215 · Prod. 79');
    expect(within(card).queryByRole('img', { name: /Aderência do setor/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Ranking de Aderência por Setor')).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: 'Visão por setor' }));
    expect(within(card).queryByRole('img', { name: /Aderência da linha/ })).not.toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'Aderência do setor BOBINA AT: 36,74%' })).toBeInTheDocument();
    expect(screen.getByText('Ranking de Aderência por Setor')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Ver detalhes de BOBINA AT' })).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Visão por setor' }));
    expect(within(card).getByRole('img', { name: 'Aderência da linha MON: 30,00%' })).toBeInTheDocument();
    expect(within(card).queryByRole('img', { name: /Aderência do setor/ })).not.toBeInTheDocument();
    expect(getDataMock).toHaveBeenCalledTimes(1);
  });

  it('mostra aderência consolidada superior a 100% sem truncar o percentual', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON'] },
      setores: [{ setor: 'SOLDA', programado: 15, produzido: 18, linhas: [
        { linha: 'MON', programado: 15, produzido: 18, potencias: [] },
      ] }],
    });
    render(<ProducaoDiariaPage />);
    const card = await screen.findByRole('article', { name: 'Produção de SOLDA' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: 'Visão por setor' }));
    expect(within(card).getByRole('img', { name: 'Aderência do setor SOLDA: 120,00%' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Prog. 15 · Prod. 18');
  });

  it('usa critérios diferentes para o filtro abaixo do programado em cada visão', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON', 'TRI'] },
      setores: [
        { setor: 'BOBINA AT', programado: 80, produzido: 80, linhas: [
          { linha: 'MON', programado: 40, produzido: 50, potencias: [] },
          { linha: 'TRI', programado: 40, produzido: 30, potencias: [] },
        ] },
        { setor: 'BOBINA BT', programado: 100, produzido: 75, linhas: [
          { linha: 'MON', programado: 60, produzido: 45, potencias: [] },
          { linha: 'TRI', programado: 40, produzido: 30, potencias: [] },
        ] },
        { setor: 'PINTURA', programado: 0, produzido: 1, linhas: [
          { linha: 'MON', programado: 0, produzido: 1, potencias: [] },
        ] },
      ],
    });
    const user = userEvent.setup();
    render(<ProducaoDiariaPage />);
    await screen.findByRole('article', { name: 'Produção de BOBINA AT' });
    await user.click(screen.getByRole('combobox', { name: 'Situação' }));
    await user.click(screen.getByRole('option', { name: 'Abaixo do programado' }));
    expect(screen.getAllByRole('article', { name: /Produção de / })).toHaveLength(2);
    expect(screen.getByRole('article', { name: 'Produção de BOBINA AT' })).toHaveTextContent('Linha abaixo do programado');
    await user.click(screen.getByRole('switch', { name: 'Visão por setor' }));
    expect(screen.getAllByRole('article', { name: /Produção de / })).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Produção de BOBINA BT' })).toHaveTextContent('Setor abaixo do programado');
    expect(screen.getByText('180 unidades')).toBeInTheDocument();
    expect(screen.getByText('156 unidades')).toBeInTheDocument();
    expect(getDataMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('switch', { name: 'Visão por setor' }));
    expect(screen.getAllByRole('article', { name: /Produção de / })).toHaveLength(2);
  });

  it('ao ativar visão por setor, remove filtro individual de linha e consulta ALL', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON', 'TRI'] },
      setores: [{ setor: 'BOBINA AT', programado: 100, produzido: 75, linhas: [
        { linha: 'MON', programado: 60, produzido: 50, potencias: [] },
        { linha: 'TRI', programado: 40, produzido: 25, potencias: [] },
      ] }],
    });
    const user = userEvent.setup();
    render(<ProducaoDiariaPage />);
    await screen.findByRole('article', { name: 'Produção de BOBINA AT' });
    await user.click(screen.getByRole('combobox', { name: 'Linha' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'MON' }));
    await waitFor(() => expect(getDataMock).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), 'MON'));
    await user.click(screen.getByRole('switch', { name: 'Visão por setor' }));
    expect(screen.queryByRole('combobox', { name: 'Linha' })).not.toBeInTheDocument();
    await waitFor(() => expect(getDataMock).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), 'ALL'));
    await user.click(screen.getByRole('switch', { name: 'Visão por setor' }));
    expect(screen.getByRole('combobox', { name: 'Linha' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Linha' })).toHaveTextContent('Todas as linhas');
  });

  it('filtra por qualquer linha pendente sem alterar totais nem refazer consulta', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON', 'TRI', 'EPO'] },
      setores: [
        { setor: 'BOBINA AT', programado: 80, produzido: 80, linhas: [
          { linha: 'MON', programado: 40, produzido: 50, potencias: [] },
          { linha: 'TRI', programado: 40, produzido: 30, potencias: [] },
        ] },
        { setor: 'ISOLANTE', programado: 60, produzido: 60, linhas: [
          { linha: 'MON', programado: 30, produzido: 30, potencias: [] },
          { linha: 'TRI', programado: 30, produzido: 30, potencias: [] },
        ] },
        { setor: 'EPOXI', programado: 0, produzido: 5, linhas: [
          { linha: 'EPO', programado: 0, produzido: 5, potencias: [] },
        ] },
      ],
    });
    const user = userEvent.setup();
    render(<ProducaoDiariaPage />);
    await screen.findByRole('article', { name: 'Produção de BOBINA AT' });
    expect(screen.getAllByRole('article', { name: /Produção de / })).toHaveLength(3);
    await user.click(screen.getByRole('combobox', { name: 'Situação' }));
    await user.click(screen.getByRole('option', { name: 'Abaixo do programado' }));
    expect(screen.getAllByRole('article', { name: /Produção de / })).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Produção de BOBINA AT' })).toBeInTheDocument();
    expect(screen.getByText('140 unidades')).toBeInTheDocument();
    expect(screen.getByText('145 unidades')).toBeInTheDocument();
    expect(getDataMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getAllByRole('article', { name: /Produção de / })).toHaveLength(3);
  });

  it('mantém o resumo e exibe mensagem quando nenhuma linha está pendente', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-12T12:00:00.000Z',
      filtros: { linhas: ['MON'] },
      setores: [{ setor: 'SOLDA', programado: 20, produzido: 25, linhas: [
        { linha: 'MON', programado: 20, produzido: 25, potencias: [] },
      ] }],
    });
    const user = userEvent.setup();
    render(<ProducaoDiariaPage />);
    await screen.findByRole('article', { name: 'Produção de SOLDA' });
    await user.click(screen.getByRole('combobox', { name: 'Situação' }));
    await user.click(screen.getByRole('option', { name: 'Abaixo do programado' }));
    expect(screen.queryByRole('article', { name: 'Produção de SOLDA' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nenhum setor abaixo do programado');
    expect(screen.getByText('20 unidades')).toBeInTheDocument();
    expect(screen.getByText('25 unidades')).toBeInTheDocument();
  });

  it('preserva as métricas e salva observação e plano com um único envio', async () => {
    getDataMock.mockResolvedValue({
      geradoEm:'2026-11-09T12:00:00.000Z',
      filtros:{linhas:['MON','TRI','EPO']},
      setores:[{setor:'MPA',programado:120,produzido:90,linhas:[
        {linha:'MON',programado:70,produzido:50,potencias:[{potencia:'5',produzido:20},{potencia:'10',produzido:30}]},
        {linha:'TRI',programado:50,produzido:40,potencias:[{potencia:'30',produzido:15},{potencia:'75',produzido:25}]},
      ]}],
    });
    const user=userEvent.setup();
    render(<ProducaoDiariaPage />);
    await screen.findByText('MPA');
    expect(screen.getAllByRole('button',{name:'Ver detalhes de MPA'})).toHaveLength(1);
    await user.click(screen.getByRole('button',{name:'Ver detalhes de MPA'}));
    const dlg=screen.getByRole('dialog');
    expect(dlg).toHaveTextContent('Detalhes · MPA');
    expect(dlg).toHaveTextContent('Monofásico (MON)');
    expect(dlg).toHaveTextContent('Trifásico (TRI)');
    expect(dlg).toHaveTextContent('20 un.');
    expect(dlg).toHaveTextContent('25 un.');
    expect(dlg).toHaveTextContent('75,00%');
    expect(screen.getAllByRole('textbox',{name:'Observação'})).toHaveLength(1);
    const ui = within(dlg);
    const save = ui.getByRole('button', { name: 'Salvar ocorrência e plano' });
    expect(save).toBeDisabled();
    expect(ui.queryByRole('button', { name: 'Salvar observação' })).not.toBeInTheDocument();
    createAcaoMock.mockResolvedValueOnce({} as Awaited<ReturnType<typeof producaoDiariaService.createAcao>>);
    await user.type(ui.getByRole('textbox', { name: 'Observação' }), 'Faltou colaborador.');
    await user.type(ui.getByRole('textbox', { name: 'Plano de ação' }), 'Solicitar remanejamento.');
    await user.type(ui.getByRole('textbox', { name: 'Responsável' }), 'Líder MON');
    fireEvent.change(ui.getByLabelText(/^Prazo/), { target: { value: '2026-11-20' } });
    await user.dblClick(save);
    expect(await ui.findByText('Ocorrência registrada.')).toBeInTheDocument();
    expect(createAcaoMock).toHaveBeenCalledTimes(1);
    expect(createAcaoMock).toHaveBeenCalledWith(expect.objectContaining({
      data_origem: expect.any(String), setor: 'MPA', linha: 'GERAL', observacao: 'Faltou colaborador.',
      plano_acao: 'Solicitar remanejamento.', responsavel: 'Líder MON', prazo: '2026-11-20', situacao: 'PENDENTE',
    }));
    expect(saveObservacaoMock).not.toHaveBeenCalled();
  });

  it('mantém rascunhos por linha e ao reabrir, sem carregar o mensal antes do clique', async () => {
    const data = previousLocalDate();
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-09T12:00:00Z', filtros: { linhas: ['MON'] },
      setores: [{ setor: 'MONTAGEM FINAL', programado: 12, produzido: 9 }],
    });
    getObservacoesMock.mockResolvedValue([
      { data, setor: 'MONTAGEM FINAL', linha: 'GERAL', observacao: 'Nota geral', atualizado_em: '', atualizado_por_login: 'Coordenação', versao: 1 },
      { data, setor: 'MONTAGEM FINAL', linha: 'MON', observacao: 'Nota MON', atualizado_em: '', atualizado_por_login: 'Coordenação', versao: 2 },
    ]);
    const user = userEvent.setup();
    render(<ProducaoDiariaPage />);
    const open = await screen.findByRole('button', { name: 'Ver detalhes de MONTAGEM FINAL' });
    await user.click(open);
    let dialog = within(screen.getByRole('dialog'));
    const line = dialog.getByRole('combobox', { name: 'Linha da observação e do plano' });
    expect(renderMonthly).not.toHaveBeenCalled();
    expect(dialog.getByRole('textbox', { name: 'Observação' })).toHaveValue('');
    await user.click(dialog.getByText('Observação legada sem plano vinculado'));
    expect(dialog.getByText('Nota geral')).toBeVisible();
    await choose(user, line, 'MON');
    const note = dialog.getByRole('textbox', { name: 'Observação' });
    expect(note).toHaveValue('');
    fireEvent.change(note, { target: { value: 'Rascunho MON' } });
    await choose(user, line, 'TRI');
    expect(note).toHaveValue('');
    await choose(user, line, 'MON');
    expect(note).toHaveValue('Rascunho MON');
    await user.click(dialog.getByRole('button', { name: 'Aderência Mensal' }));
    expect(await dialog.findByText('Conteúdo mensal compartilhado')).toBeInTheDocument();
    expect(renderMonthly).toHaveBeenCalledWith({
      embedded: true, initialFilters: { mes: data.slice(0, 7), setor: 'MONTAGEM FINAL', linha: 'MON' },
    });
    await user.click(dialog.getByRole('button', { name: 'Produção e ações' }));
    expect(note).toHaveValue('Rascunho MON');
    await user.keyboard('{Escape}');
    expect(open).toHaveFocus();
    await user.click(open);
    dialog = within(screen.getByRole('dialog'));
    await choose(user, dialog.getByRole('combobox', { name: 'Linha da observação e do plano' }), 'MON');
    expect(dialog.getByRole('textbox', { name: 'Observação' })).toHaveValue('Rascunho MON');
  });

  it('mostra acompanhamento sem produção, filtra encerradas e mantém ação geral no filtro de linha', async () => {
    const action = {
      id: '5ae3c3d0-f4df-487c-a706-02687b97fbc8', data_origem: '2026-01-02', setor: 'MPA', linha: 'GERAL' as const,
      observacao: 'Dispositivo com folga', plano_acao: 'Rever dispositivo', prazo: '2026-01-03', responsavel: 'Manutenção', situacao: 'PENDENTE' as const,
      versao: 1, criado_em: '', atualizado_em: '', concluido_em: null, criado_por_login: 'COORD', atualizado_por_login: 'COORD',
    };
    getDataMock.mockResolvedValue({ geradoEm: '2026-11-09T12:00:00Z', filtros: { linhas: [] }, setores: [] });
    getAcoesMock.mockImplementation(async ({ status }) => ({
      acoes: status === 'CONCLUIDA' ? [{ ...action, situacao: 'CONCLUIDA' }] : [action], proximoCursor: null,
    }));
    const user = userEvent.setup();
    render(<ProducaoDiariaPage />);
    expect(await screen.findByText('Rever dispositivo')).toBeInTheDocument();
    expect(screen.getByText('Prazo vencido')).toBeInTheDocument();
    const lineFilter = screen.getByRole('combobox', { name: 'Linha no acompanhamento' });
    await choose(user, lineFilter, 'Ações gerais do setor');
    await waitFor(() => expect(getAcoesMock).toHaveBeenLastCalledWith(expect.objectContaining({ linha: 'GERAL' })));
    await choose(user, lineFilter, 'Todas as linhas');
    await waitFor(() => expect(getAcoesMock).toHaveBeenLastCalledWith(expect.objectContaining({ linha: undefined })));
    await choose(user, lineFilter, 'MON');
    expect(await screen.findByText('Rever dispositivo')).toBeInTheDocument();
    expect(getAcoesMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ABERTAS', linha: 'MON' }));
    await choose(user, screen.getByRole('combobox', { name: 'Situação no acompanhamento' }), 'Concluídas');
    expect(await screen.findByText('Concluída')).toBeInTheDocument();
    expect(screen.queryByText('Prazo vencido')).not.toBeInTheDocument();
  });

  it('mantém rascunho e chave de criação ao tentar novamente após erro', async () => {
    getDataMock.mockResolvedValue({
      geradoEm: '2026-11-09T12:00:00Z', filtros: { linhas: ['EPO'] },
      setores: [{ setor: 'EPOXI', programado: 0, produzido: 5 }],
    });
    createAcaoMock.mockRejectedValueOnce(new Error('Falha de rede')).mockResolvedValueOnce({} as Awaited<ReturnType<typeof producaoDiariaService.createAcao>>);
    const user = userEvent.setup();
    render(<ProducaoDiariaPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes de EPOXI' }));
    const dialog = within(screen.getByRole('dialog'));
    const line = dialog.getByRole('combobox', { name: 'Linha da observação e do plano' });
    await user.click(line);
    const menu = within(dialog.getByRole('listbox'));
    expect(menu.getAllByRole('option').map((item) => item.textContent)).toEqual(['Todas as linhas', 'EPO']);
    await user.keyboard('{Escape}');
    expect(dialog.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(line).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(line).toHaveTextContent('EPO');
    await user.type(dialog.getByRole('textbox', { name: 'Observação' }), 'Falha no banho');
    await user.type(dialog.getByRole('textbox', { name: 'Plano de ação' }), 'Ajustar banho');
    await user.type(dialog.getByRole('textbox', { name: 'Responsável' }), 'Processos');
    fireEvent.change(dialog.getByLabelText(/^Prazo/), { target: { value: '2026-11-20' } });
    await user.click(dialog.getByRole('button', { name: 'Salvar ocorrência e plano' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Falha de rede');
    expect(dialog.getByRole('textbox', { name: 'Plano de ação' })).toHaveValue('Ajustar banho');
    await user.click(dialog.getByRole('button', { name: 'Salvar ocorrência e plano' }));
    expect(await dialog.findByText('Ocorrência registrada.')).toBeInTheDocument();
    expect(createAcaoMock.mock.calls[0][0]).toEqual(createAcaoMock.mock.calls[1][0]);
  });
  it('recarrega a versão sem perder a observação em edição após conflito', async () => {
    const action = {
      id: '05b49b77-04db-4b04-808a-0036e062515f', data_origem: '2026-01-02', setor: 'MPA', linha: 'MON' as const,
      observacao: 'Observação original', plano_acao: 'Inspecionar máquina', prazo: '2026-12-23',
      responsavel: 'Manutenção', situacao: 'PENDENTE' as const, versao: 1,
      criado_em: '', atualizado_em: '', concluido_em: null, criado_por_login: 'COORD', atualizado_por_login: 'COORD',
    };
    getDataMock.mockResolvedValue({ geradoEm: '2026-11-09T12:00:00Z', filtros: { linhas: [] }, setores: [] });
    getAcoesMock.mockResolvedValue({ acoes: [action], proximoCursor: null });
    vi.mocked(producaoDiariaService.getAcao).mockResolvedValue({ ...action, versao: 2, observacao: 'Versão do servidor', prazo: '2026-12-26' });
    const patch = vi.mocked(producaoDiariaService.updateAcao);
    patch.mockRejectedValueOnce(new ApiError('Recarregue', 409, undefined)).mockResolvedValueOnce({ ...action, versao: 3 });
    const user = userEvent.setup();
    render(<ProducaoDiariaPage />);
    await user.click(await screen.findByRole('button', { name: 'Editar ação' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Editar ação' }));
    const observation = dialog.getByRole('textbox', { name: 'Observação' });
    fireEvent.change(observation, { target: { value: 'Meu rascunho' } });
    const submit = dialog.getByRole('button', { name: 'Salvar alterações' });
    await user.click(submit);
    expect(await dialog.findByRole('alert')).toHaveTextContent('Recarregue');
    expect(submit).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: 'Recarregar ação' }));
    await waitFor(() => expect(observation).toHaveValue('Meu rascunho'));
    expect(await dialog.findByText(/Versão do servidor/)).toBeVisible();
    expect(dialog.getByLabelText(/^Prazo/)).toHaveValue('2026-12-26');
    await user.click(submit);
    expect(patch).toHaveBeenLastCalledWith(action.id, expect.objectContaining({ versao: 2, observacao: 'Meu rascunho', prazo: '2026-12-26' }));
  });
});
