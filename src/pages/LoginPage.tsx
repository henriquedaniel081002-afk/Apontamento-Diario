import React, { useId, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userFieldId = useId();
  const passwordFieldId = useId();
  const errorId = useId();
  const selectedUser = MOCK_USERS.find((user) => user.id === selectedUserId) ?? null;

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-3 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-40 -top-40 size-[32rem] rounded-full bg-emerald-400/[0.07] blur-3xl" />
        <div className="absolute -bottom-56 right-[-10rem] size-[38rem] rounded-full bg-lime-300/[0.035] blur-3xl" />
        <div className="login-grid absolute inset-0 opacity-40" />
      </div>

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#090e0b]/95 shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative flex min-h-72 flex-col justify-between overflow-hidden border-b border-white/[0.08] bg-[#070b08] p-6 sm:p-8 lg:min-h-[38rem] lg:border-b-0 lg:border-r lg:p-10">
          <div className="relative z-10">
            <img
              src={logoItam}
              alt="ITAM Transformadores"
              className="h-auto w-44 object-contain sm:w-52"
            />

            <div className="mt-9 max-w-md lg:mt-16">
              <Badge variant="success" className="mb-4 uppercase tracking-[0.16em]">
                Operação industrial
              </Badge>
              <h1 className="text-2xl font-black leading-tight tracking-[-0.03em] text-white sm:text-3xl">
                Apontamentos confiáveis, todos os dias.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Registre produção, faltas e observações em um fluxo único, seguro e rastreável.
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

        <section className="flex items-center bg-[#0c120e] p-5 sm:p-8 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7">
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
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
                <select
                  id={userFieldId}
                  value={selectedUserId}
                  required
                  autoFocus
                  aria-invalid={Boolean(errorMessage && !selectedUser) || undefined}
                  aria-describedby={errorMessage && !selectedUser ? errorId : undefined}
                  onChange={(event) => {
                    setSelectedUserId(event.target.value);
                    setErrorMessage(null);
                  }}
                  className="field-control"
                >
                  <option value="">Selecione um usuário</option>
                  {MOCK_USERS.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.perfil === 'COORDENACAO'
                        ? 'COORDENAÇÃO — Acesso global'
                        : `${user.name} — ${user.setor}`}
                    </option>
                  ))}
                </select>

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
