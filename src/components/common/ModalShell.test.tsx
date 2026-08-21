import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModalShell } from './ModalShell';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('ModalShell', () => {
  it('renderiza em portal, bloqueia a página e fecha com Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ModalShell isOpen onClose={onClose} title="Detalhes do dia" description="Produção de 21/08">
        <button type="button">Ação interna</button>
      </ModalShell>,
    );

    expect(screen.getByRole('dialog', { name: 'Detalhes do dia' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fechar janela' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mantém Escape e fechamento externo bloqueados durante operação ocupada', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ModalShell isOpen busy onClose={onClose} title="Importando">
        <p>Aguarde</p>
      </ModalShell>,
    );

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Fechar janela' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('aplica a apresentação drawer e o tamanho 2xl sem alterar a semântica', () => {
    render(
      <ModalShell isOpen onClose={() => undefined} title="Detalhamento EPOXI" size="2xl" presentation="drawer">
        <p>Conteúdo</p>
      </ModalShell>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Detalhamento EPOXI' });
    expect(dialog).toHaveClass('modal-dialog--drawer', 'max-w-7xl');
    expect(dialog.parentElement).toHaveAttribute('data-presentation', 'drawer');
  });

  it('devolve o foco ao acionador após desmontar', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Abrir';
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <ModalShell isOpen onClose={() => undefined} title="Janela">
        <button type="button">Continuar</button>
      </ModalShell>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Fechar janela' })).toHaveFocus());
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
