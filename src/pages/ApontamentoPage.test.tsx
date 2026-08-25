import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apontamentoService } from '../services/apontamentoService';
import type { Apontamento, User } from '../types';
import { ApontamentoPage } from './ApontamentoPage';

vi.mock('../services/apontamentoService', () => ({
  apontamentoService: {
    getPendingImported: vi.fn(),
    completeImported: vi.fn(),
  },
}));

const apontador: User = {
  id: 'usr-solda',
  name: 'Solda',
  perfil: 'APONTADOR',
  setor: 'SOLDA',
  linhas: ['MON', 'TRI'],
};

const pendingRecord: Apontamento = {
  id: 'apontamento-importado-1',
  data: '2026-08-20',
  setor: 'SOLDA',
  userId: apontador.id,
  userName: apontador.name,
  linhasPermitidas: apontador.linhas,
  producoes: [
    { id: 'producao-1', linha: 'TRI', potencia: 150, quantidade: 12 },
  ],
  paradasFaltaMaterial: [],
  paradasMaquina: [],
  naoConformidades: [],
  faltas: [],
  observacoes: [],
  createdAt: '2026-08-20T12:00:00.000Z',
  updatedAt: '2026-08-20T12:00:00.000Z',
  statusAprovacao: 'PENDENTE',
  origemProducao: 'IMPORTADO',
  complementado: false,
  turno1Complementado: false,
  turno2Complementado: false,
};

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(apontamentoService.getPendingImported).mockResolvedValue([pendingRecord]);
});

describe('ApontamentoPage', () => {
  it('mantém as sete etapas montadas e preserva o rascunho ao navegar', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ApontamentoPage user={apontador} onNavigateToHistory={vi.fn()} />,
    );

    expect(await screen.findByRole('heading', { name: 'Qual turno você está apontando?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /1º turno/i }));
    expect(await screen.findByRole('heading', { name: 'Produção do dia' })).toBeVisible();

    const stepper = screen.getByRole('navigation', {
      name: 'Etapas do complemento do apontamento',
    });
    expect(within(stepper).getAllByRole('button')).toHaveLength(7);
    expect(container.querySelectorAll('[hidden]')).toHaveLength(6);

    expect(screen.getByText('Parada por Falta de Material', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Parada por Máquina Quebrada', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Não Conformidade', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Faltas', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Observações', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Revisão e envio', { selector: 'h2' })).toBeInTheDocument();

    await user.click(within(stepper).getByRole('button', { name: /Material/ }));
    const cause = screen.getByLabelText('Causa / Motivo');
    const material = screen.getByLabelText('Material');
    fireEvent.change(cause, { target: { value: 'Atraso no abastecimento' } });
    fireEvent.change(material, { target: { value: 'Chapa 2 mm' } });

    await user.click(within(stepper).getByRole('button', { name: /Máquina/ }));
    expect(screen.getByRole('heading', { name: 'Parada por Máquina Quebrada' })).toBeVisible();

    await user.click(within(stepper).getByRole('button', { name: /Material/ }));
    expect(screen.getByLabelText('Causa / Motivo')).toHaveValue('Atraso no abastecimento');
    expect(screen.getByLabelText('Material')).toHaveValue('Chapa 2 mm');
    expect(container.querySelectorAll('[hidden]')).toHaveLength(6);
  }, 10_000);
});
