import React from 'react';
import { User } from '../../types';
import { LogOut, ClipboardList, History, ShieldCheck } from 'lucide-react';
import logoItam from '../../assets/logo-itam.png';

interface HeaderProps {
  user: User;
  activeTab: 'apontamento' | 'historico';
  onTabChange: (tab: 'apontamento' | 'historico') => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onTabChange,
  onLogout,
}) => {
  const isCoordenacao = user.perfil === 'COORDENACAO';
  const lineLabel = user.linhas.join(' / ');

  return (
    <header className="bg-[#0D120F] border-b border-white/10 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          <div className="flex items-center space-x-3 shrink-0">
            <img
              src={logoItam}
              alt="ITAM Transformadores"
              className="h-10 w-auto max-w-[112px] object-contain"
            />
            <div className="hidden sm:block border-l border-white/10 h-5 my-auto" />
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-200 tracking-tight">
                {isCoordenacao ? 'Painel da Coordenação' : 'Apontamento Diário'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {isCoordenacao ? 'Consulta e gestão de registros' : 'Controle de Produção'}
              </span>
            </div>
          </div>

          {!isCoordenacao ? (
            <nav className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => onTabChange('apontamento')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'apontamento'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-100 hover:bg-white/[0.06]'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Apontamento</span>
              </button>

              <button
                onClick={() => onTabChange('historico')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'historico'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-100 hover:bg-white/[0.06]'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Histórico</span>
              </button>
            </nav>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Acesso global</span>
            </div>
          )}

          <div className="flex items-center space-x-3 shrink-0">
            {!isCoordenacao && user.setor && (
              <div className="hidden md:flex items-center space-x-2 bg-white/[0.06] border border-white/10 rounded-full px-3 py-1 text-xs">
                <span className="font-semibold text-slate-200">{user.setor}</span>
                <span className="text-slate-500">•</span>
                <span className="font-bold text-emerald-400 bg-[#0D120F] px-2 py-0.5 rounded-full border border-white/10 shadow-2xs">
                  {lineLabel}
                </span>
              </div>
            )}

            {isCoordenacao && (
              <div className="hidden md:block text-xs font-bold text-slate-300">COORDENAÇÃO</div>
            )}

            <button
              onClick={onLogout}
              title="Sair do sistema"
              className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-500/25"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {!isCoordenacao && user.setor && (
        <div className="md:hidden bg-[#090D0A] border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Setor: <strong className="text-slate-200">{user.setor}</strong></span>
          <span className="font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
            LINHA: {lineLabel}
          </span>
        </div>
      )}
    </header>
  );
};
