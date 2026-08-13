import React, { useState } from 'react';
import { User } from '../types';
import { MOCK_USERS } from '../mocks/mockData';
import { Eye, EyeOff, UserCheck, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import logoItam from '../assets/logo-itam.png';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  authLogin: (userId: string, passwordAttempt: string) => Promise<{ success: boolean; user?: User; error?: string }>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, authLogin }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(MOCK_USERS[5]?.id || MOCK_USERS[0].id);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedUser = MOCK_USERS.find((u) => u.id === selectedUserId) || MOCK_USERS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const result = await authLogin(selectedUserId, password);
    setIsSubmitting(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setErrorMessage(result.error || 'Usuário ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen bg-[#050806] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-slate-100">
      <div className="max-w-4xl w-full bg-[#0B100D] rounded-3xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
        <div className="md:col-span-5 bg-[#070B08] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-white/10">
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-green-400/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center">
              <img
                src={logoItam}
                alt="ITAM Transformadores"
                className="w-[230px] max-w-full h-auto object-contain"
              />
            </div>

            <div className="mt-12 space-y-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-white leading-tight">
                Sistema de Apontamento Diário
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Plataforma corporativa para lançamento rápido de produção, faltas e observações do setor.
              </p>
            </div>
          </div>

          <div className="mt-8 relative z-10 pt-6 border-t border-white/10 space-y-3">
            <div className="flex items-center space-x-2.5 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Identificação automática de setor e linha</span>
            </div>
            <div className="flex items-center space-x-2.5 text-xs text-slate-300">
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Lançamento inteligente por potência (kVA)</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 p-8 sm:p-10 flex flex-col justify-center bg-[#0B100D]">
          <div className="mb-6">
            <div className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400 mb-3">
              Acesso seguro
            </div>
            <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">Acessar Sistema</h2>
            <p className="text-xs text-slate-500 mt-1">Selecione seu perfil de acesso e informe sua senha.</p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-2.5 text-rose-200 text-xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Usuário / Posto de Trabalho
              </label>
              <div className="relative">
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full bg-[#070B08] border border-white/15 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-10"
                >
                  {MOCK_USERS.map((user) => (
                    <option key={user.id} value={user.id} className="bg-[#0B100D] text-slate-100">
                      {user.perfil === 'COORDENACAO' ? 'COORDENAÇÃO (Acesso global)' : `${user.name} (${user.setor})`}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ArrowRight className="w-4 h-4 rotate-90" />
                </div>
              </div>

              <div className="mt-2 p-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">
                  Setor vinculado: <strong className="text-slate-200">{selectedUser.setor}</strong>
                </span>
                <span className="font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
                  {selectedUser.linhas.length === 1 ? `LINHA ${selectedUser.linhas[0]}` : `LINHAS ${selectedUser.linhas.join(' e ')}`}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="w-full bg-[#070B08] border border-white/15 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 p-1 transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#041007] font-extrabold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
