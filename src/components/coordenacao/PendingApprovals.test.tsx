import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { PendingApprovals } from './PendingApprovals';
import { pendenciasAprovacaoService, type PendingApproval, type PendingApprovalResult } from '../../services/pendenciasAprovacaoService';

vi.mock('../../services/pendenciasAprovacaoService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/pendenciasAprovacaoService')>(),
  pendenciasAprovacaoService: { get: vi.fn() },
}));

const record: PendingApproval = {
  id: '10', versao: '2026-09-10 11:00:00+00', data: '2026-09-10', setor: 'SOLDA', createdAt: '2026-09-10T11:00:00Z',
  statusAprovacao: 'PENDENTE', possuiProducao: true, origemProducao: 'IMPORTADO', complementado: true,
  totalOcorrencias: 2,
  ocorrencias: [
    { id: '1', tipo: 'MATERIAL', turno: '1º turno', linha: null, detalhes: { Material: 'Chapa 2,65 mm', Motivo: 'Sem estoque' } },
    { id: '2', tipo: 'FALTAS', turno: '2º turno', linha: 'MON', detalhes: { Quantidade: 2, Justificativa: 'Transporte', Atestado: false } },
  ],
};
const response = (registros = [record]): PendingApprovalResult => ({
  total: registros.length, totalOcorrencias: registros.length * 2, totalFiltrado: registros.length,
  setores: ['SOLDA'], pagina: 1, tamanhoPagina: 20, registros,
});
const props = () => ({ recordsRevision: [], approvalBusyId: null, feedback: null, onAction: vi.fn().mockResolvedValue(undefined) });

beforeEach(() => vi.mocked(pendenciasAprovacaoService.get).mockResolvedValue(response()));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function open() {
  const user = userEvent.setup();
  await screen.findByText('1 apontamento(s) pendente(s)');
  await user.click(screen.getByRole('button', { name: 'Ver pendências' }));
  await screen.findByText('Chapa 2,65 mm');
  return user;
}

describe('Pendências de aprovação', () => {
  it('consulta o resumo inicialmente e mostra todas as ocorrências com uma única ação por apontamento', async () => {
    const p = props();
    render(<PendingApprovals {...p} />);
    const user = await open();
    expect(pendenciasAprovacaoService.get).toHaveBeenNthCalledWith(1, { dataInicio: '', dataFim: '', setor: '', tipo: '' }, 1, true, expect.any(AbortSignal));
    expect(screen.getByText('2 ocorrência(s) · Todos os períodos e setores')).toBeInTheDocument();
    expect(screen.getByText('Turno: 1º turno')).toBeInTheDocument();
    expect(screen.getByText('Turno: 2º turno')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reprovar/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aprovar apontamento 10 de SOLDA' }));
    expect(p.onAction).toHaveBeenCalledExactlyOnceWith(record, 'APROVAR');
  });

  it.each([
    [{ complementado: false }, 'Aguardando o apontador finalizar'],
  ])('mantém o bloqueio atual de aprovação: %j', async (override, message) => {
    vi.mocked(pendenciasAprovacaoService.get).mockResolvedValue(response([{ ...record, ...override }]));
    const p = props(); render(<PendingApprovals {...p} />); await open();
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar apontamento 10 de SOLDA' })).toBeDisabled();
    expect(p.onAction).not.toHaveBeenCalled();
  });

  it('envia período, setor e tipo somente ao aplicar os filtros próprios', async () => {
    // jsdom não implementa a rolagem utilizada pelo CustomSelect real.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    render(<PendingApprovals {...props()} />); const user = await open();
    const calls = vi.mocked(pendenciasAprovacaoService.get).mock.calls.length;
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-09-10' } });
    await user.click(screen.getByRole('combobox', { name: 'Setor das pendências' }));
    await user.click(screen.getByRole('option', { name: /^SOLDA$/ }));
    await user.click(screen.getByRole('combobox', { name: 'Tipo das pendências' }));
    await user.click(screen.getByRole('option', { name: /^Faltas$/ }));
    expect(pendenciasAprovacaoService.get).toHaveBeenCalledTimes(calls);
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(pendenciasAprovacaoService.get).toHaveBeenLastCalledWith({ dataInicio: '2026-09-01', dataFim: '2026-09-10', setor: 'SOLDA', tipo: 'FALTAS' }, 1, false, expect.any(AbortSignal)));
    expect(await screen.findByText('Chapa 2,65 mm')).toBeInTheDocument();
  });

  it('atualiza contador e lista quando a aprovação altera os registros da Coordenação', async () => {
    const p = props(); const view = render(<PendingApprovals {...p} />); await open();
    vi.mocked(pendenciasAprovacaoService.get).mockResolvedValue(response([]));
    view.rerender(<PendingApprovals {...p} recordsRevision={[]} feedback={{ id: '1', type: 'success', message: 'Apontamento aprovado com sucesso.' }} />);
    expect(await screen.findByText('Nenhum apontamento pendente de aprovação.')).toBeInTheDocument();
    expect(screen.getByText('0 apontamento(s) pendente(s)')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Apontamento aprovado com sucesso.');
    expect(screen.queryByRole('button', { name: 'Aprovar apontamento 10 de SOLDA' })).not.toBeInTheDocument();
  });

  it('oculta dados desatualizados no erro e permite tentar novamente', async () => {
    render(<PendingApprovals {...props()} />); const user = await open();
    vi.mocked(pendenciasAprovacaoService.get).mockRejectedValueOnce(new Error('Falha de conexão'));
    await user.click(screen.getByRole('button', { name: 'Atualizar pendências' }));
    expect(await screen.findByText('Falha de conexão')).toBeInTheDocument();
    expect(screen.queryByText('Chapa 2,65 mm')).not.toBeInTheDocument();
    expect(screen.getByText('Não foi possível consultar o total.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Chapa 2,65 mm')).toBeInTheDocument();
  });

  it('mantém o total geral mesmo sem resultados no filtro e pagina pelo resultado do servidor', async () => {
    render(<PendingApprovals {...props()} />); const user = await open();
    vi.mocked(pendenciasAprovacaoService.get).mockResolvedValue({ ...response(), total: 21, totalFiltrado: 21 });
    await user.click(screen.getByRole('button', { name: 'Atualizar pendências' }));
    await screen.findByText('21 apontamento(s) pendente(s)');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(pendenciasAprovacaoService.get).toHaveBeenLastCalledWith(expect.anything(), 2, false, expect.any(AbortSignal)));
    vi.mocked(pendenciasAprovacaoService.get).mockResolvedValue({ ...response([]), total: 21, totalFiltrado: 0 });
    await user.click(screen.getByRole('button', { name: 'Atualizar pendências' }));
    expect(await screen.findByText('Nenhuma pendência corresponde aos filtros.')).toBeInTheDocument();
    expect(screen.getByText('21 apontamento(s) pendente(s)')).toBeInTheDocument();
  });
});


describe('Novas ações da fila', () => {
  it('permite aprovar sem produção, inclusive sem complemento, e impede clique duplo', async () => {
    const pending = { ...record, possuiProducao: false, complementado: false };
    vi.mocked(pendenciasAprovacaoService.get).mockResolvedValue(response([pending]));
    const p = props(); p.onAction.mockImplementation(() => new Promise(() => {}));
    render(<PendingApprovals {...p} />); const user = await open();
    expect(screen.getByText('Aguardando Produção · Aprovação manual disponível.')).toBeInTheDocument();
    const approve = screen.getByRole('button', { name: 'Aprovar apontamento 10 de SOLDA' });
    await user.dblClick(approve);
    expect(p.onAction).toHaveBeenCalledExactlyOnceWith(pending, 'APROVAR');
    expect(approve).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluir apontamento 10 de SOLDA' })).toBeDisabled();
  });

  it('cancelar a confirmação não executa ação alguma', async () => {
    const p = props(); render(<PendingApprovals {...p} />); const user = await open();
    await user.click(screen.getByRole('button', { name: 'Excluir apontamento 10 de SOLDA' }));
    const confirm = screen.getByRole('dialog', { name: 'Excluir apontamento?' });
    expect(within(confirm).getByText(/A produção vinculada será preservada/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(p.onAction).not.toHaveBeenCalled();
    expect(screen.getByText('Chapa 2,65 mm')).toBeInTheDocument();
  });

  it.each([true, false])('exclui somente após confirmação (possui produção: %s)', async (possuiProducao) => {
    const target = { ...record, possuiProducao };
    vi.mocked(pendenciasAprovacaoService.get).mockResolvedValue(response([target]));
    const p = props(); render(<PendingApprovals {...p} />); const user = await open();
    await user.click(screen.getByRole('button', { name: 'Excluir apontamento 10 de SOLDA' }));
    expect(p.onAction).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog', { name: 'Excluir apontamento?' })).getByRole('button', { name: /^Excluir$/ }));
    expect(p.onAction).toHaveBeenCalledExactlyOnceWith(target, 'EXCLUIR');
  });

  it('falha de exclusão mantém o registro e mostra erro', async () => {
    const p = props(); p.onAction.mockRejectedValue(new Error('Falha ao excluir'));
    render(<PendingApprovals {...p} />); const user = await open();
    await user.click(screen.getByRole('button', { name: 'Excluir apontamento 10 de SOLDA' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Excluir apontamento?' })).getByRole('button', { name: /^Excluir$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao excluir');
    expect(screen.getByText('Chapa 2,65 mm')).toBeInTheDocument();
  });

  it('conflito em outra sessão recarrega a fila mantendo o período aplicado', async () => {
    const p = props(); p.onAction.mockRejectedValue(new ApiError('Registro alterado', 409, {}));
    render(<PendingApprovals {...p} />); const user = await open();
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-09-01' } });
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await screen.findByText('Chapa 2,65 mm');
    vi.mocked(pendenciasAprovacaoService.get).mockResolvedValue(response([]));
    await user.click(screen.getByRole('button', { name: 'Aprovar apontamento 10 de SOLDA' }));
    expect(await screen.findByText('Nenhum apontamento pendente de aprovação.')).toBeInTheDocument();
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-09-01');
    expect(screen.getByRole('alert')).toHaveTextContent('Registro alterado');
  });
});
