import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Apontamento } from '../../types';
import { CoordinationRecords } from './CoordinationRecords';

function makeRecord(overrides: Partial<Apontamento> = {}): Apontamento {
  return {
    id: 'record-1',
    data: '2026-08-20',
    setor: 'PINTURA',
    userId: 'usr-pintura',
    userName: 'Pintura',
    linhasPermitidas: ['MON', 'TRI'],
    producoes: [{ id: 'production-1', linha: 'MON', potencia: 75, quantidade: 8 }],
    faltas: [],
    observacoes: [],
    createdAt: '2026-08-20T12:00:00.000Z',
    updatedAt: '2026-08-20T12:00:00.000Z',
    statusAprovacao: 'PENDENTE',
    origemProducao: 'MANUAL',
    complementado: true,
    ...overrides,
  };
}

const passiveActions = {
  onView: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

afterEach(cleanup);

describe('CoordinationRecords — aprovação', () => {
  it('bloqueia a aprovação de produção importada que ainda aguarda complemento', async () => {
    const user = userEvent.setup();
    const onApprovalChange = vi.fn();
    const record = makeRecord({
      origemProducao: 'IMPORTADO',
      complementado: false,
    });

    render(
      <CoordinationRecords
        {...passiveActions}
        records={[record]}
        showApprovalActions
        onApprovalChange={onApprovalChange}
      />,
    );

    expect(screen.getByText('Aguardando complemento')).toBeInTheDocument();
    const approval = screen.getByRole('button', { name: /ainda aguarda complemento/i });
    expect(approval).toBeDisabled();
    expect(approval).toHaveAttribute(
      'title',
      'Aguarde o apontador finalizar o complemento das ocorrências antes de aprovar.',
    );

    await user.click(approval);
    expect(onApprovalChange).not.toHaveBeenCalled();
  });

  it('permite desfazer um registro aprovado e solicita o status PENDENTE', async () => {
    const user = userEvent.setup();
    const onApprovalChange = vi.fn();
    const record = makeRecord({
      statusAprovacao: 'APROVADO',
      aprovadoPorNome: 'Coordenação',
    });

    render(
      <CoordinationRecords
        {...passiveActions}
        records={[record]}
        showApprovalActions
        onApprovalChange={onApprovalChange}
      />,
    );

    expect(screen.getByText('Aprovado')).toHaveAttribute('title', 'Aprovado por Coordenação');
    await user.click(screen.getByRole('button', { name: /Desfazer aprovação/i }));

    expect(onApprovalChange).toHaveBeenCalledTimes(1);
    expect(onApprovalChange).toHaveBeenCalledWith(record, 'PENDENTE');
  });
});
