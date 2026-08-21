import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Factory,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { User } from '../types';
import { MOCK_USERS } from '../mocks/mockData';
import logoItam from '../assets/logo-itam.png';
import { Badge, Button, FieldError, Surface } from '../components/common/ui';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  authLogin: (
    userId: string,
    passwordAttempt: string,
  ) => Promise<{ success: boolean; user?: User; error?: string }>;
  initialMessage?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  authLogin,
  initialMessage = null,
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [highlightedUserIndex, setHighlightedUserIndex] = useState(0);
  const [userMenuPlacement, setUserMenuPlacement] = useState<'up' | 'down'>('down');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userFieldId = useId();
  const passwordFieldId = useId();
  const errorId = useId();
  const userListboxId = useId();
  const userSelectorRef = useRef<HTMLDivElement>(null);
  const selectedUser = MOCK_USERS.find((user) => user.id === selectedUserId) ?? null;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!userSelectorRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const selectUser = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserMenuOpen(false);
    setErrorMessage(null);
  };

  const resolveUserMenuPlacement = () => {
    const rect = userSelectorRef.current?.getBoundingClientRect();
    if (!rect) return;

    const estimatedMenuHeight = 304;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setUserMenuPlacement(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'up' : 'down');
  };

  const handleUserSelectorKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setIsUserMenuOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isUserMenuOpen) {
        resolveUserMenuPlacement();
        setIsUserMenuOpen(true);
      }
      setHighlightedUserIndex((current) => {
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        return (current + delta + MOCK_USERS.length) % MOCK_USERS.length;
      });
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isUserMenuOpen) {
        const highlightedUser = MOCK_USERS[highlightedUserIndex];
        if (highlightedUser) selectUser(highlightedUser.id);
      } else {
        resolveUserMenuPlacement();
        setIsUserMenuOpen(true);
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!selectedUser) {
      setErrorMessage('Selecione o usuário ou posto de trabalho para continuar.');
      return;
    }

    if (!password) {
      setErrorMessage('Informe sua senha de acesso para continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authLogin(selectedUser.id, password);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
        return;
      }

      setErrorMessage(result.error || 'Usuário ou senha incorretos.');
    } catch {
      setErrorMessage('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-industrial-stage relative flex min-h-[100dvh] items-start justify-center overflow-x-hidden overflow-y-auto px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-40 -top-40 size-[32rem] rounded-full bg-emerald-400/[0.07] blur-3xl" />
        <div className="absolute -bottom-56 right-[-10rem] size-[38rem] rounded-full bg-lime-300/[0.035] blur-3xl" />
        <div className="login-grid absolute inset-0 opacity-40" />
      </div>

      <div className="relative my-auto grid w-full max-w-6xl overflow-hidden rounded-[1.65rem] border border-emerald-300/[0.12] bg-[#070b08]/96 shadow-[0_38px_120px_rgba(0,0,0,0.62)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="login-showcase relative flex min-h-80 flex-col justify-between overflow-hidden border-b border-emerald-300/[0.08] p-6 sm:p-9 lg:min-h-[40rem] lg:border-b-0 lg:border-r lg:p-11">
          <div className="relative z-10">
            <img
              src={logoItam}
              alt="ITAM Transformadores"
              className="h-auto w-44 object-contain sm:w-52"
            />

            <div className="mt-10 max-w-lg lg:mt-20">
              <Badge variant="success" className="mb-4 uppercase tracking-[0.16em]">
                Operação industrial
              </Badge>
              <div className="login-accent-line mb-5" aria-hidden="true" />
              <h1 className="login-wordmark text-[2rem] font-black uppercase leading-[1.02] text-white sm:text-[2.65rem] lg:text-[3rem]">
                Produção em foco.<br />
                <span className="text-[#00c76f]">Apontamentos com clareza.</span>
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Uma experiência mais clara e objetiva para registrar a rotina diária de produção.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                <Factory className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-slate-200">Contexto automático</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">Setor e linhas vinculados ao seu acesso.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-slate-200">Acesso protegido</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">Sessão autenticada para cada perfil.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center bg-[linear-gradient(180deg,#0b120e,#070b08)] p-5 sm:p-9 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300 shadow-[0_0_30px_rgba(0,199,111,.06)]">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">Acessar o sistema</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">
                Selecione seu perfil de acesso e informe a senha.
              </p>
            </div>

            {initialMessage && !errorMessage && (
              <div
                role="status"
                className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] p-3.5 text-sm text-amber-100"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
                <p className="font-semibold leading-5">{initialMessage}</p>
              </div>
            )}

            {errorMessage && (
              <div
                id={errorId}
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-400/[0.08] p-3.5 text-sm text-rose-100"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-300" aria-hidden="true" />
                <p className="font-semibold leading-5">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor={userFieldId} className="field-label">
                  Usuário ou posto de trabalho
                </label>
                <div ref={userSelectorRef} className="relative">
                  <button
                    id={userFieldId}
                    type="button"
                    autoFocus
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-expanded={isUserMenuOpen}
                    aria-controls={userListboxId}
                    aria-invalid={Boolean(errorMessage && !selectedUser) || undefined}
                    aria-describedby={errorMessage && !selectedUser ? errorId : undefined}
                    onClick={() => {
                      const selectedIndex = MOCK_USERS.findIndex((user) => user.id === selectedUserId);
                      setHighlightedUserIndex(selectedIndex >= 0 ? selectedIndex : 0);
                      if (!isUserMenuOpen) resolveUserMenuPlacement();
                      setIsUserMenuOpen((current) => !current);
                    }}
                    onKeyDown={handleUserSelectorKeyDown}
                    className="field-control flex cursor-pointer items-center justify-between gap-3 text-left"
                  >
                    <span className={selectedUser ? 'truncate text-slate-100' : 'truncate text-slate-500'}>
                      {selectedUser
                        ? selectedUser.perfil === 'COORDENACAO'
                          ? 'COORDENAÇÃO — Acesso global'
                          : `${selectedUser.name} — ${selectedUser.setor}`
                        : 'Selecione um usuário'}
                    </span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {isUserMenuOpen && (
                    <div
                      id={userListboxId}
                      role="listbox"
                      aria-label="Usuários e postos de trabalho"
                      className={`absolute z-40 max-h-[min(18rem,calc(100dvh-2rem))] w-full overflow-y-auto rounded-xl border border-emerald-400/20 bg-[#07100B] p-1.5 shadow-[0_20px_55px_rgba(0,0,0,0.62)] ring-1 ring-black/30 ${userMenuPlacement === 'up' ? 'bottom-full mb-2' : 'mt-2'}`}
                    >
                      {MOCK_USERS.map((user, index) => {
                        const isSelected = user.id === selectedUserId;
                        const isHighlighted = index === highlightedUserIndex;
                        return (
                          <button
                            key={user.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setHighlightedUserIndex(index)}
                            onClick={() => selectUser(user.id)}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-emerald-400/12 text-emerald-100'
                                : isHighlighted
                                  ? 'bg-white/[0.07] text-white'
                                  : 'text-slate-200 hover:bg-white/[0.06]'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">
                                {user.perfil === 'COORDENACAO' ? 'COORDENAÇÃO' : user.name}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">
                                {user.perfil === 'COORDENACAO' ? 'Acesso global' : user.setor}
                              </span>
                            </span>
                            {isSelected && <Check className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedUser && (
                  <Surface tone="inset" padding="sm" className="mt-2.5 flex items-center justify-between gap-3 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Contexto de acesso</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-200">
                        {selectedUser.perfil === 'COORDENACAO' ? 'Acesso global' : selectedUser.setor}
                      </p>
                    </div>
                    {selectedUser.perfil === 'COORDENACAO' ? (
                      <Badge variant="success">
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        Coordenação
                      </Badge>
                    ) : (
                      <Badge variant="neutral">
                        {selectedUser.linhas.length === 1 ? 'Linha ' : 'Linhas '}
                        {selectedUser.linhas.join(' / ')}
                      </Badge>
                    )}
                  </Surface>
                )}
              </div>

              <div>
                <label htmlFor={passwordFieldId} className="field-label">
                  Senha de acesso
                </label>
                <div className="relative">
                  <input
                    id={passwordFieldId}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    required
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    aria-invalid={Boolean(errorMessage && selectedUser && !password) || undefined}
                    aria-describedby={errorMessage && selectedUser && !password ? errorId : undefined}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrorMessage(null);
                    }}
                    className="field-control pr-14"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <FieldError className="sr-only">{errorMessage}</FieldError>
              </div>

              <Button
                type="submit"
                size="lg"
                fullWidth
                isLoading={isSubmitting}
                loadingLabel="Autenticando..."
                rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                Entrar no sistema
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
              <span>Ambiente corporativo ITAM</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
