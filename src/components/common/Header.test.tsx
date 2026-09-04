import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../types';
import { Header } from './Header';

afterEach(cleanup);

const apontador: User = {
  id: 'apontador-1',
  name: 'Operador de Pintura',
  perfil: 'APONTADOR',
  setor: 'PINTURA',
  linhas: ['MON'],
};

const coordenacao: User = {
  id: 'coordenacao-1',
  name: 'Coordenação Industrial',
  perfil: 'COORDENACAO',
  setor: null,
  linhas: ['MON', 'TRI', 'EPO'],
};

describe('Header compartilhado', () => {
  it('preserva as abas do apontador e comunica a página ativa', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Header user={apontador} activeTab="apontamento" onTabChange={onTabChange} onLogout={() => undefined} />,
    );

    const activeLinks = screen.getAllByRole('button', { name: 'Apontamento' });
    expect(activeLinks[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('button', { name: 'Histórico' })).not.toHaveLength(0);
    await user.click(screen.getAllByRole('button', { name: 'Histórico' })[0]);
    expect(onTabChange).toHaveBeenCalledWith('historico');
  });

  it('preserva as abas existentes e adiciona os dashboards da coordenação', async () => {
    const onTabChange = vi.fn();
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(
      <Header user={coordenacao} activeTab="dashboard" onTabChange={onTabChange} onLogout={onLogout} />,
    );

    expect(screen.getAllByRole('button', { name: 'Aderência Mensal' })[0]).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getAllByRole('button', { name: 'Produção Diária' })[0]);
    expect(onTabChange).toHaveBeenCalledWith('producao-diaria');
    await user.click(screen.getAllByRole('button', { name: 'Registros' })[0]);
    expect(onTabChange).toHaveBeenCalledWith('apontamento');
    await user.click(screen.getAllByRole('button', { name: 'Controle Faltas' })[0]);
    expect(onTabChange).toHaveBeenCalledWith('controle-faltas');
    await user.click(screen.getAllByRole('button', { name: 'Produtividade' })[0]);
    expect(onTabChange).toHaveBeenCalledWith('produtividade-individual');
    await user.click(screen.getAllByRole('button', { name: 'Atraso' })[0]);
    expect(onTabChange).toHaveBeenCalledWith('atraso');
    await user.click(screen.getByRole('button', { name: 'Sair do sistema' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('mantém o atalho de salto para o conteúdo principal', () => {
    render(
      <Header user={apontador} activeTab="historico" onTabChange={() => undefined} onLogout={() => undefined} />,
    );

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo-principal',
    );
  });

  it('permite recolher e expandir a barra lateral', async () => {
    const user = userEvent.setup();
    render(
      <Header user={coordenacao} activeTab="dashboard" onTabChange={() => undefined} onLogout={() => undefined} />,
    );

    const collapseButton = screen.getByRole('button', { name: 'Recolher barra lateral' });
    await user.click(collapseButton);
    expect(screen.getByRole('button', { name: 'Expandir barra lateral' })).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'Expandir barra lateral' }));
    expect(screen.getByRole('button', { name: 'Recolher barra lateral' })).toHaveAttribute('aria-expanded', 'true');
  });
});
