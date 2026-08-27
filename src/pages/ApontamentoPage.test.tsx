import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apontamentoService } from '../services/apontamentoService';
import type { User } from '../types';
import { ApontamentoPage } from './ApontamentoPage';

vi.mock('../services/apontamentoService', () => ({
  apontamentoService: {
    getPendingImported: vi.fn(),
    getByDateAndSector: vi.fn(),
    completeImported: vi.fn(),
    saveOccurrences: vi.fn(),
  },
}));

const apontador: User = {
  id: 'usr-solda',
  name: 'Solda',
  perfil: 'APONTADOR',
  setor: 'SOLDA',
  linhas: ['MON', 'TRI'],
};

afterEach(cleanup);

beforeEach(() => {
  vi.mocked(apontamentoService.getByDateAndSector).mockResolvedValue(null);
});

describe('ApontamentoPage', () => {
  it('em Solda seleciona o turno antes de registrar ocorrências e preserva o rascunho entre etapas', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ApontamentoPage user={apontador} onNavigateToHistory={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Qual turno você está apontando?' })).toBeVisible();
    const registerButton = screen.getByRole('button', { name: 'Registrar ocorrências' });
    expect(registerButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /1º turno/i }));
    expect(registerButton).toBeEnabled();
    await user.click(registerButton);

    const dateInput = await screen.findByLabelText('Data');
    expect(dateInput).toHaveValue(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(await screen.findByText('Produção aguardando importação')).toBeVisible();

    const stepper = screen.getByRole('navigation', { name: 'Etapas do registro de ocorrências' });
    expect(within(stepper).getAllByRole('button')).toHaveLength(6);
    expect(container.querySelectorAll('[hidden]')).toHaveLength(5);

    const cause = screen.getByLabelText('Causa / Motivo');
    const material = screen.getByLabelText('Material');
    fireEvent.change(cause, { target: { value: 'Atraso no abastecimento' } });
    fireEvent.change(material, { target: { value: 'Chapa 2 mm' } });

    await user.click(within(stepper).getByRole('button', { name: /Máquina/ }));
    expect(screen.getByRole('heading', { name: 'Parada por Máquina Quebrada' })).toBeVisible();

    await user.click(within(stepper).getByRole('button', { name: /Material/ }));
    expect(screen.getByLabelText('Causa / Motivo')).toHaveValue('Atraso no abastecimento');
    expect(screen.getByLabelText('Material')).toHaveValue('Chapa 2 mm');
  }, 10_000);
});

const isolante: User = {
  id: 'usr-isolante',
  name: 'Isolante',
  perfil: 'APONTADOR',
  setor: 'ISOLANTE',
  linhas: ['MON', 'TRI'],
};

it('mantém a produção importada e também libera registro antecipado nos demais setores', async () => {
  const user = userEvent.setup();
  vi.mocked(apontamentoService.getPendingImported).mockResolvedValue([
    {
      id: 'importado-isolante-1',
      data: '2026-08-25',
      setor: 'ISOLANTE',
      userId: isolante.id,
      userName: isolante.name,
      linhasPermitidas: isolante.linhas,
      producoes: [{ id: 'prod-1', linha: 'MON', potencia: 15, quantidade: 8 }],
      paradasFaltaMaterial: [],
      paradasMaquina: [],
      naoConformidades: [],
      faltas: [],
      observacoes: [],
      createdAt: '2026-08-25T12:00:00.000Z',
      updatedAt: '2026-08-25T12:00:00.000Z',
      origemProducao: 'IMPORTADO',
      complementado: false,
    },
  ]);

  render(<ApontamentoPage user={isolante} onNavigateToHistory={vi.fn()} />);

  expect(await screen.findByText('Selecione o dia para completar')).toBeVisible();
  const registerButton = screen.getByRole('button', { name: 'Registrar ocorrências' });
  expect(registerButton).toBeEnabled();
  await user.click(registerButton);

  expect(screen.queryByRole('heading', { name: 'Qual turno você está apontando?' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Registrar ocorrências' }));
  expect(await screen.findByLabelText('Data')).toBeVisible();
  expect(apontamentoService.getByDateAndSector).toHaveBeenCalledWith(
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    'ISOLANTE',
    isolante.id,
    undefined,
  );
});

it('agrupa Montagem do Núcleo/Corte do Núcleo e mantém controle de turno nos dois', async () => {
  const user = userEvent.setup();
  const montagemNucleo: User = {
    id: 'usr-montagem-nucleo',
    name: 'Montagem Nucleo',
    perfil: 'APONTADOR',
    setor: 'MONTAGEM NUCLEO',
    linhas: ['MON', 'TRI'],
  };

  render(<ApontamentoPage user={montagemNucleo} onNavigateToHistory={vi.fn()} />);

  expect(screen.getByRole('heading', { name: 'Qual turno você está apontando?' })).toBeVisible();
  const registerButton = screen.getByRole('button', { name: 'Registrar ocorrências' });
  expect(registerButton).toBeDisabled();

  await user.click(screen.getByRole('button', { name: /2º turno/i }));
  await user.click(screen.getByRole('button', { name: /Corte do Núcleo/i }));
  expect(registerButton).toBeEnabled();
  await user.click(registerButton);

  expect(await screen.findByRole('heading', { name: /Corte do Núcleo · 2º turno/i })).toBeVisible();
  expect(apontamentoService.getByDateAndSector).toHaveBeenCalledWith(
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    'CORTE DO NUCLEO',
    montagemNucleo.id,
    undefined,
  );
});

it('no login Corte do Laser/Ferragem exige escolher o setor e mantém Ferragem separado', async () => {
  const user = userEvent.setup();
  const corteLaser: User = {
    id: 'usr-corte-laser',
    name: 'Corte Laser',
    perfil: 'APONTADOR',
    setor: 'CORTE LASER',
    linhas: ['MON', 'TRI'],
  };

  render(<ApontamentoPage user={corteLaser} onNavigateToHistory={vi.fn()} />);

  const registerButton = screen.getByRole('button', { name: 'Registrar ocorrências' });
  await user.click(screen.getByRole('button', { name: /1º turno/i }));
  expect(registerButton).toBeDisabled();

  await user.click(screen.getByRole('button', { name: /Ferragem/i }));
  expect(registerButton).toBeEnabled();
  await user.click(registerButton);

  expect(await screen.findByRole('heading', { name: /Ferragem · 1º turno/i })).toBeVisible();
  expect(apontamentoService.getByDateAndSector).toHaveBeenCalledWith(
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    'FERRAGEM',
    corteLaser.id,
    undefined,
  );
});
