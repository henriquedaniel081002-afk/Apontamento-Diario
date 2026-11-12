import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { producaoDiariaService } from '../services/producaoDiariaService';
import { ProducaoDiariaPage } from './ProducaoDiariaPage';

vi.mock('../services/producaoDiariaService', () => ({
  producaoDiariaService: { getData: vi.fn(), getObservacoes: vi.fn(), saveObservacao: vi.fn() },
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

  it('usa um único olho e uma observação geral; exibe MON, TRI e quantidades por potência', async () => {
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
    saveObservacaoMock.mockImplementation(async(data,setor,linha,observacao)=>({
      data,setor,linha,observacao,atualizado_em:'2026-11-09T14:00:00Z',atualizado_por_login:'COORDENACAO',
    }));
    await user.type(screen.getByRole('textbox',{name:'Observação'}),'Produção antecipada.');
    await user.click(screen.getByRole('button',{name:'Salvar observação'}));
    await waitFor(()=>expect(saveObservacaoMock).toHaveBeenCalledWith(expect.any(String),'MPA','GERAL','Produção antecipada.'));
  });

});
