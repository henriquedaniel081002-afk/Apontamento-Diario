import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MOCK_USERS } from '../mocks/mockData';
import { LoginPage } from './LoginPage';

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

describe('LoginPage', () => {
  it('seleciona o perfil pelo teclado e autentica com o mesmo ID funcional', async () => {
    const user = userEvent.setup();
    const coordinator = MOCK_USERS.find((candidate) => candidate.id === 'usr-coordenacao');
    expect(coordinator).toBeDefined();

    const authLogin = vi.fn().mockResolvedValue({ success: true, user: coordinator });
    const onLoginSuccess = vi.fn();

    render(<LoginPage authLogin={authLogin} onLoginSuccess={onLoginSuccess} />);

    const profile = screen.getByRole('combobox', { name: 'Usuário ou posto de trabalho' });
    expect(profile).toHaveFocus();

    await user.keyboard('{ArrowDown}{End}{Enter}');
    expect(profile).toHaveTextContent('COORDENAÇÃO — Acesso global');

    await user.type(screen.getByLabelText('Senha de acesso'), 'senha-segura');
    await user.click(screen.getByRole('button', { name: 'Entrar no sistema' }));

    await waitFor(() => {
      expect(authLogin).toHaveBeenCalledWith('usr-coordenacao', 'senha-segura');
      expect(onLoginSuccess).toHaveBeenCalledWith(coordinator);
    });
  });

  it('mantém o usuário na tela e comunica a falha devolvida pela autenticação', async () => {
    const user = userEvent.setup();
    const authLogin = vi.fn().mockResolvedValue({
      success: false,
      error: 'Usuário ou senha incorretos.',
    });
    const onLoginSuccess = vi.fn();

    render(<LoginPage authLogin={authLogin} onLoginSuccess={onLoginSuccess} />);

    await user.keyboard('{ArrowDown}{Enter}');
    await user.type(screen.getByLabelText('Senha de acesso'), 'senha-incorreta');
    await user.click(screen.getByRole('button', { name: 'Entrar no sistema' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.');
    expect(authLogin).toHaveBeenCalledWith('usr-bobinagem', 'senha-incorreta');
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });
});
