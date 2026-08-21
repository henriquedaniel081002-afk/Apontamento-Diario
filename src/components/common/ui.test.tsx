import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CustomSelect } from './CustomSelect';
import {
  Button,
  DataTable,
  Field,
  Input,
  StatusBadge,
  Stepper,
} from './ui';

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

describe('primitivos visuais compartilhados', () => {
  it('associa label, ajuda e erro ao controle do campo', () => {
    render(
      <Field label="Data" hint="Use o dia do apontamento" error="Data inválida" required>
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText(/Data/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Use o dia do apontamento Data inválida');
    expect(screen.getByRole('alert')).toHaveTextContent('Data inválida');
  });

  it('associa o CustomSelect ao campo e anuncia a opção ativa pelo teclado', async () => {
    const user = userEvent.setup();
    render(
      <Field label="Setor" hint="Escolha o setor operacional" error="Setor obrigatório">
        <CustomSelect
          value=""
          onChange={vi.fn()}
          options={[
            { value: '', label: 'Selecione' },
            { value: 'SOLDA', label: 'Solda' },
          ]}
        />
      </Field>,
    );

    const select = screen.getByRole('combobox', { name: 'Setor' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Escolha o setor operacional Setor obrigatório');

    await user.click(select);
    await user.keyboard('{ArrowDown}');

    const activeOption = screen.getByRole('option', { name: 'Solda' });
    expect(select).toHaveAttribute('aria-activedescendant', activeOption.id);
  });

  it('renderiza tabela semântica e preserva o alinhamento das colunas', () => {
    render(
      <DataTable
        caption="Produção diária"
        rows={[{ id: '1', setor: 'PINTURA', total: 12 }]}
        columns={[
          { id: 'setor', header: 'Setor', cell: (row) => row.setor },
          { id: 'total', header: 'Produzido', cell: (row) => row.total, align: 'right' },
        ]}
      />,
    );

    expect(screen.getByRole('table', { name: 'Produção diária' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Produzido' })).toHaveClass('text-right');
    expect(screen.getByRole('cell', { name: '12' })).toHaveClass('text-right');
  });

  it('expõe estado vazio reutilizável sem uma tabela quebrada', () => {
    render(
      <DataTable<{ id: string }>
        rows={[]}
        columns={[{ id: 'id', header: 'ID', cell: (row) => row.id }]}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('mantém o Stepper navegável e identifica a etapa ativa', async () => {
    const onStepChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Stepper
        activeStep={1}
        onStepChange={onStepChange}
        steps={[
          { id: 'producao', label: 'Produção' },
          { id: 'faltas', label: 'Faltas', description: 'Ocorrências do turno', count: 2 },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: /Faltas/ })).toHaveAttribute('aria-current', 'step');
    expect(container.querySelector('.workflow-stepper')).toHaveClass('overflow-x-auto');
    await user.click(screen.getByRole('button', { name: /Produção/ }));
    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  it('oferece variantes success e status com indicador semântico', () => {
    render(
      <>
        <Button variant="success">Aprovar</Button>
        <StatusBadge variant="success" dot>Aprovado</StatusBadge>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Aprovar' })).toHaveClass('min-h-11');
    expect(screen.getByText('Aprovado')).toHaveTextContent('Aprovado');
  });
});
