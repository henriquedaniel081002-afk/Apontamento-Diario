import React from 'react';
import { ClipboardList, History, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { User } from '../../types';
import logoItam from '../../assets/logo-itam.png';
import { Badge, cx } from './ui';

interface HeaderProps {
  user: User;
  activeTab: 'apontamento' | 'historico';
  onTabChange: (tab: 'apontamento' | 'historico') => void;
  onLogout: () => void;
}

interface NavigationProps {
  activeTab: HeaderProps['activeTab'];
  onTabChange: HeaderProps['onTabChange'];
  compact?: boolean;
}

function Navigation({ activeTab, onTabChange, compact = false }: NavigationProps) {
  const items = [
    { id: 'apontamento' as const, label: 'Apontamento', icon: ClipboardList },
    { id: 'historico' as const, label: 'Histórico', icon: History },
  ];

  return (
    <nav aria-label="Navegação principal" className={cx('flex items-center gap-1', compact && 'min-w-0 flex-1')}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={cx(
              'flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300',
              compact && 'min-w-0 flex-1 px-2',
              isActive
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export const Header: React.FC<HeaderProps> = ({ user, activeTab, onTabChange, onLogout }) => {
  const isCoordenacao = user.perfil === 'COORDENACAO';
  const lineLabel = user.linhas.join(' / ');
  const contextLabel = isCoordenacao ? 'Acesso global' : user.setor || 'Setor não informado';

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080d0a]/95 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <a
        href="#conteudo-principal"
        className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-lg bg-emerald-300 px-3 py-2 text-sm font-extrabold text-emerald-950 shadow-lg transition-transform focus:translate-y-0 focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center gap-3">
          <div className="flex min-w-0 shrink items-center gap-3 lg:min-w-64">
            <img
              src={logoItam}
              alt="ITAM Transformadores"
              className="h-9 w-auto max-w-[96px] object-contain sm:h-10 sm:max-w-[112px]"
            />
            <span className="hidden h-7 w-px bg-white/10 sm:block" aria-hidden="true" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-extrabold tracking-tight text-white">
                {isCoordenacao ? 'Coordenação' : activeTab === 'apontamento' ? 'Apontamento diário' : 'Histórico'}
              </p>
              <p className="truncate text-[11px] font-medium text-slate-500">Operação industrial</p>
            </div>
          </div>

          {!isCoordenacao ? (
            <div className="hidden flex-1 justify-center md:flex">
              <Navigation activeTab={activeTab} onTabChange={onTabChange} />
            </div>
          ) : (
            <div className="hidden flex-1 justify-center md:flex">
              <Badge variant="success" className="min-h-8 px-3">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Acesso global
              </Badge>
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 lg:flex">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400">
                <UserRound className="size-4" aria-hidden="true" />
              </div>
              <div className="max-w-44 min-w-0">
                <p className="truncate text-xs font-bold text-slate-200">{user.name}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {contextLabel}{!isCoordenacao && lineLabel ? ` · ${lineLabel}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              title="Sair do sistema"
              aria-label="Sair do sistema"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-3 text-xs font-bold text-slate-400 transition-colors hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-white/[0.07] py-2 md:hidden">
          {!isCoordenacao ? (
            <Navigation activeTab={activeTab} onTabChange={onTabChange} compact />
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span className="truncate text-xs font-bold text-slate-200">Painel da Coordenação</span>
            </div>
          )}

          <div
            className="max-w-28 truncate rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-right text-[10px] font-bold text-slate-300 min-[420px]:max-w-44"
            title={!isCoordenacao && lineLabel ? `${contextLabel} · ${lineLabel}` : contextLabel}
          >
            {isCoordenacao ? 'Acesso global' : lineLabel || contextLabel}
          </div>
        </div>
      </div>
    </header>
  );
};
