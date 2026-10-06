import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/apiClient';
import { naoConformidadesService } from '../services/naoConformidadesService';
import type { NaoConformidadeDashboardItem } from '../types/naoConformidades';
import { NaoConformidadesPage } from './NaoConformidadesPage';

vi.mock('../services/naoConformidadesService', () => ({ naoConformidadesService: { listar: vi.fn(), reparar: vi.fn() } }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null, Bar: () => null, Cell: () => null, Tooltip: () => null,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
}));
const listar = vi.mocked(naoConformidadesService.listar);
const reparar = vi.mocked(naoConformidadesService.reparar);
const pending: NaoConformidadeDashboardItem = { id: '1', apontamentoId: '10', data: '2026-10-02', setorId: '1', setor: 'SOLDA', turno: '1º turno',
  causaNaoConformidade: 'Descrição completa da falha', op: 'OP-100', numeroSerie: 'SER-200', criadoEm: '2026-10-02T12:00:00Z', statusReparo: 'AGUARDANDO_REPARO' };
const repaired: NaoConformidadeDashboardItem = { ...pending, id: '2', statusReparo: 'REPARADO', descricaoReparo: 'Solda refeita e verificada', reparadoEm: '2026-10-03T12:00:00Z', reparadoPorNome: 'Operador de Solda' };
const response = (registros = [pending, repaired]) => ({ registros, setores: [{ id: '1', nome: 'SOLDA' }] });
const kpi = (name: string) => within(screen.getByRole('article', { name }));
const openPending = async (user: ReturnType<typeof userEvent.setup>) => {
  // jsdom não aplica breakpoints; desktop e cartões compartilham os handlers.
  await user.click((await screen.findAllByRole('button', { name: 'Tratar NC 1' }))[0]);
  return screen.getByRole('dialog', { name: 'Tratar Não Conformidade' });
};

beforeEach(() => { listar.mockReset().mockResolvedValue(response()); reparar.mockReset(); Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);

describe('Página Não Conformidades', () => {
  it('exibe loading, quatro KPIs e gráficos com os mesmos registros', async () => {
    render(<NaoConformidadesPage />);
    expect(screen.getByText('Carregando Não Conformidades...')).toBeInTheDocument();
    await screen.findByRole('article', { name: 'Total de NCs' });
    expect(kpi('Total de NCs').getByText('2')).toBeInTheDocument();
    expect(kpi('Aguardando reparo').getByText('1')).toBeInTheDocument();
    expect(kpi('Reparadas').getByText('1')).toBeInTheDocument();
    expect(kpi('Percentual reparadas').getByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'SOLDA: 2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Aguardando reparo: 1; Reparado: 1' })).toBeInTheDocument();
    const filters = listar.mock.calls[0][0];
    expect(filters.dataInicio.endsWith('-01')).toBe(true);
    expect(filters.dataFim.slice(0, 7)).toBe(filters.dataInicio.slice(0, 7));
  });
  it('modal mostra dados completos, exige conteúdo real e atualiza linha, KPIs e gráficos após reparar', async () => {
    reparar.mockResolvedValue({ ...repaired, id: '1' });
    const user = userEvent.setup();
    render(<NaoConformidadesPage />);
    const dialog = await openPending(user);
    for (const value of ['SOLDA', '02/10/2026', '1º turno', 'OP-100', 'SER-200', pending.causaNaoConformidade]) expect(within(dialog).getByText(value)).toBeInTheDocument();
    const description = within(dialog).getByRole('textbox', { name: 'Como foi reparado?' });
    const confirm = within(dialog).getByRole('button', { name: 'Confirmar reparo' });
    expect(confirm).toBeDisabled();
    await user.type(description, '   ');
    expect(confirm).toBeDisabled();
    expect(reparar).not.toHaveBeenCalled();
    await user.clear(description);
    await user.type(description, ' Refeito ');
    await user.click(confirm);
    expect(reparar).toHaveBeenCalledExactlyOnceWith('1', 'Refeito');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Reparo registrado com sucesso.')).toBeInTheDocument();
    expect(kpi('Reparadas').getByText('2')).toBeInTheDocument();
    expect(kpi('Percentual reparadas').getByText('100%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tratar NC 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Aguardando reparo: 0; Reparado: 2' })).toBeInTheDocument();
  });
  it('reparada é somente consulta, com descrição e responsável', async () => {
    const user = userEvent.setup();
    render(<NaoConformidadesPage />);
    await user.click((await screen.findAllByRole('button', { name: 'Ver detalhes da NC 2' }))[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(repaired.descricaoReparo!)).toBeInTheDocument();
    expect(within(dialog).getByText(repaired.reparadoPorNome!)).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Confirmar reparo' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('filtros enviam período, setor, status e busca à API', async () => {
    const user = userEvent.setup();
    render(<NaoConformidadesPage />);
    await screen.findByRole('article', { name: 'Total de NCs' });
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-09-30' } });
    await user.click(screen.getByRole('combobox', { name: 'Setor' }));
    await user.click(screen.getByRole('option', { name: 'SOLDA' }));
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Reparado' }));
    await user.type(screen.getByRole('searchbox', { name: 'OP ou número de série' }), 'SER-200');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ dataInicio: '2026-09-01', dataFim: '2026-09-30', setorId: '1', status: 'REPARADO', busca: 'SER-200' }));
  });
  it('reparo sai dos resultados ao filtrar aguardando, sem recarregar a página', async () => {
    const user = userEvent.setup();
    listar.mockResolvedValue(response([pending]));
    reparar.mockResolvedValue({ ...repaired, id: '1' });
    render(<NaoConformidadesPage />);
    await screen.findByRole('article', { name: 'Total de NCs' });
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Aguardando reparo' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    const dialog = await openPending(user);
    await user.type(within(dialog).getByRole('textbox'), 'x');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar reparo' }));
    expect(await screen.findByText('Nenhuma Não Conformidade encontrada')).toBeInTheDocument();
    expect(kpi('Total de NCs').getByText('0')).toBeInTheDocument();
    expect(kpi('Percentual reparadas').getByText('0%')).toBeInTheDocument();
  });
  it('erro de leitura mantém mensagem da API e oferece nova tentativa', async () => {
    listar.mockRejectedValueOnce(new ApiError('Consulta indisponível', 500, {}));
    const user = userEvent.setup();
    render(<NaoConformidadesPage />);
    expect(await screen.findByText('Consulta indisponível')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('article', { name: 'Total de NCs' })).toBeInTheDocument();
  });
  it('erro ao salvar preserva o texto digitado para nova tentativa', async () => {
    reparar.mockRejectedValue(new ApiError('Falha temporária', 500, {}));
    const user = userEvent.setup();
    render(<NaoConformidadesPage />);
    const dialog = await openPending(user);
    await user.type(within(dialog).getByRole('textbox'), 'Refeito');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar reparo' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Falha temporária');
    expect(within(dialog).getByRole('textbox')).toHaveValue('Refeito');
    expect(within(dialog).getByRole('button', { name: 'Confirmar reparo' })).toBeEnabled();
  });
  it('409 fecha tratamento e atualiza o registro para consulta', async () => {
    reparar.mockRejectedValue(new ApiError('Já reparada em outra sessão', 409, {}));
    const user = userEvent.setup();
    render(<NaoConformidadesPage />);
    const dialog = await openPending(user);
    listar.mockResolvedValue(response([{ ...repaired, id: '1' }]));
    await user.type(within(dialog).getByRole('textbox'), 'Refeito');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar reparo' }));
    expect(await screen.findByText('Já reparada em outra sessão')).toBeInTheDocument();
    await screen.findAllByRole('button', { name: 'Ver detalhes da NC 1' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tratar NC 1' })).not.toBeInTheDocument();
  });
  it('não duplica envio enquanto aguarda confirmação', async () => {
    let finish!: (item: NaoConformidadeDashboardItem) => void;
    reparar.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<NaoConformidadesPage />);
    const dialog = await openPending(user);
    await user.type(within(dialog).getByRole('textbox'), 'x');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar reparo' }));
    expect(within(dialog).getByRole('button', { name: 'Registrando reparo' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    finish({ ...repaired, id: '1' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(reparar).toHaveBeenCalledTimes(1);
  });
});
