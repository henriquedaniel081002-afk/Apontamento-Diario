// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayDetailModal } from './DayDetailModal';

afterEach(cleanup);

describe('DayDetailModal', () => {
  it('preserva potência por linha e apresenta todos os detalhes operacionais do dia', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <DayDetailModal
        item={{ dia: '05', data: '2024-02-05', programado: 100, produzido: 120 }}
        setor="MONTAGEM FINAL"
        linha="Todas"
        turno="Primeiro"
        detalhes={[
          { data: '2024-02-05', setor: 'MONTAGEM FINAL', linha: 'MON', potencia: 30, quantidade: 10 },
          { data: '2024-02-05', setor: 'MONTAGEM FINAL', linha: 'TRI', potencia: 30, quantidade: 20 },
          { data: '2024-02-06', setor: 'MONTAGEM FINAL', linha: 'MON', potencia: 99, quantidade: 999 },
        ]}
        faltas={[
          { data: '2024-02-05', setor: 'MONTAGEM FINAL', linha: 'MON', turno: 'Primeiro', quantidade: 2 },
          { data: '2024-02-05', setor: 'MONTAGEM FINAL', linha: 'TRI', turno: 'Segundo', quantidade: 9 },
        ]}
        observacoes={[
          { data: '2024-02-05', setor: 'MONTAGEM FINAL', linha: 'MON', observacao: 'Observação legada' },
        ]}
        detalhesFaltas={[
          {
            data: '2024-02-05',
            setor: 'MONTAGEM FINAL',
            linha: 'MON',
            turno: 'Primeiro',
            nome: 'Ana Operadora',
            motivoJustificativa: 'Consulta médica',
            atestado: 'Sim',
            quantidade: 1,
          },
        ]}
        detalhesObservacoes={[
          {
            data: '2024-02-05',
            setor: 'MONTAGEM FINAL',
            linha: 'MON',
            observacao: 'Ajuste de setup',
            justificativaMeta: 'Troca de ferramental',
          },
        ]}
        faltasMaterial={[
          {
            data: '2024-02-05',
            setor: 'MONTAGEM FINAL',
            material: 'Resina',
            causaMotivo: 'Atraso do fornecedor',
            horaInicio: '08:00',
            horaFim: '09:30',
          },
        ]}
        maquinasQuebradas={[
          {
            data: '2024-02-05',
            setor: 'MONTAGEM FINAL',
            maquinaEquipamento: 'Prensa 07',
            horaInicio: '22:00',
            horaFim: '01:00',
            observacao: 'Falha hidráulica',
          },
        ]}
        naoConformidades={[
          {
            data: '2024-02-05',
            setor: 'MONTAGEM FINAL',
            causa: 'Dimensão fora da tolerância',
            op: 'OP-123',
            numeroSerie: 'SN-456',
          },
        ]}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /05 de fevereiro de 2024/i });
    expect(dialog).toHaveTextContent('MONTAGEM FINAL • Todas as linhas • Primeiro turno');
    expect(dialog).toHaveTextContent('120,00%');

    const production = within(dialog).getByRole('region', { name: 'Produção por potência' });
    const productionRows = within(production).getAllByRole('row');
    expect(productionRows).toHaveLength(4);
    expect(within(production).getAllByText('30 kVA')).toHaveLength(2);
    expect(within(production).getByText('MON')).toBeInTheDocument();
    expect(within(production).getByText('TRI')).toBeInTheDocument();
    expect(within(production).queryByText('99 kVA')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('tab', { name: /Faltas/i }));
    expect(within(dialog).getByText('Ana Operadora')).toBeInTheDocument();
    expect(within(dialog).getByText('Consulta médica')).toBeInTheDocument();

    const faltasTab = within(dialog).getByRole('tab', { name: /Faltas/i });
    faltasTab.focus();
    await user.keyboard('{ArrowRight}');
    const ocorrenciasTab = within(dialog).getByRole('tab', { name: /Ocorrências/i });
    expect(ocorrenciasTab).toHaveFocus();
    expect(ocorrenciasTab).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByText('Ajuste de setup')).toBeInTheDocument();
    expect(within(dialog).queryByText('Observação legada')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('tab', { name: /Falta de Material/i }));
    expect(within(dialog).getByText('Resina')).toBeInTheDocument();
    expect(within(dialog).getByText('1h 30min')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('tab', { name: /Máquinas/i }));
    expect(within(dialog).getByText('Prensa 07')).toBeInTheDocument();
    expect(within(dialog).getByText('3h')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('tab', { name: /Não Conformidades/i }));
    expect(within(dialog).getByText('Dimensão fora da tolerância')).toBeInTheDocument();
    expect(within(dialog).getByText('OP-123')).toBeInTheDocument();
    expect(within(dialog).getByText('SN-456')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Fechar detalhamento diário' }));
    expect(onClose).toHaveBeenCalledOnce();
  }, 15_000);

  it('mantém o resumo legado de faltas quando não há registros individuais', async () => {
    const user = userEvent.setup();

    render(
      <DayDetailModal
        item={{ dia: '05', data: '2024-02-05', programado: 0, produzido: 0 }}
        setor="BOBINAGEM"
        linha="MON"
        turno="Todos"
        detalhes={[]}
        faltas={[
          { data: '2024-02-05', setor: 'BOBINAGEM', linha: 'MON', turno: 'Primeiro', quantidade: 3 },
        ]}
        observacoes={[]}
        onClose={() => undefined}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('—')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('tab', { name: /Faltas/i }));

    expect(within(dialog).getByText(/gerado por uma base anterior/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Primeiro turno')).toBeInTheDocument();
    expect(within(dialog).getByText('3')).toBeInTheDocument();
  });
});
