import React from 'react';
import {
  BarChart3,
  ClipboardList,
  History,
  LogOut,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { User } from '../../types';
import logoItam from '../../assets/logo-itam.png';
import { cx } from './ui';

export type HeaderTab = 'apontamento' | 'historico' | 'dashboard';

export interface HeaderProps {
  user: User;
  activeTab: HeaderTab;
  onTabChange: (tab: HeaderTab) => void;
  onLogout: () => void;
}

interface NavigationItem {
  id: HeaderTab;
  label: string;
  icon: LucideIcon;
}

interface NavigationConfig {
  ariaLabel: string;
  items: NavigationItem[];
}

interface NavigationProps extends NavigationConfig {
  activeTab: HeaderTab;
  onTabChange: HeaderProps['onTabChange'];
  compact?: boolean;
}

const navigationByProfile: Record<User['perfil'], NavigationConfig> = {
  APONTADOR: {
    ariaLabel: 'Navegação principal',
    items: [
      { id: 'apontamento', label: 'Apontamento', icon: ClipboardList },
      { id: 'historico', label: 'Histórico', icon: History },
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    ],
  },
  COORDENACAO: {
    ariaLabel: 'Navegação da coordenação',
    items: [
      { id: 'apontamento', label: 'Registros', icon: ShieldCheck },
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    ],
  },
};

function Navigation({
  activeTab,
  onTabChange,
  items,
  ariaLabel,
  compact = false,
}: NavigationProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cx('flex items-center gap-1', compact && 'min-w-0 flex-1')}
    >
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
              'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300',
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

function getPageTitle(isCoordination: boolean, activeTab: HeaderTab): string {
  if (isCoordination) return activeTab === 'dashboard' ? 'Dashboard de Aderência' : 'Coordenação';
  if (activeTab === 'dashboard') return 'Dashboard de Aderência';
  return activeTab === 'apontamento' ? 'Apontamento diário' : 'Histórico';
}

export const Header: React.FC<HeaderProps> = ({ user, activeTab, onTabChange, onLogout }) => {
  const isCoordination = user.perfil === 'COORDENACAO';
  const lineLabel = user.linhas.join(' / ');
  const contextLabel = isCoordination
    ? 'Acesso global'
    : user.setor === 'CORTE LASER'
      ? 'Corte do Laser/Ferragem'
      : user.setor || 'Setor não informado';
  const navigation = navigationByProfile[user.perfil];

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-300/[0.08] bg-[#040806]/92 shadow-[0_12px_40px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
      <a
        href="#conteudo-principal"
        className="fixed left-3 top-3 z-[70] inline-flex min-h-11 -translate-y-24 items-center rounded-lg bg-emerald-300 px-3 py-2.5 text-sm font-extrabold text-emerald-950 shadow-lg transition-transform focus:translate-y-0 focus:outline-none"
      >
        Pular para o conteúdo
      </a>

      <div className="app-container app-container--default">
        <div className="flex min-h-[4.5rem] items-center gap-3">
          <div className="flex min-w-0 shrink items-center gap-3 lg:min-w-64">
            <img
              src={logoItam}
              alt="ITAM Transformadores"
              className="h-10 w-auto max-w-[108px] object-contain sm:h-11 sm:max-w-[124px]"
            />
            <span className="hidden h-7 w-px bg-white/10 sm:block" aria-hidden="true" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-extrabold tracking-tight text-white">
                {getPageTitle(isCoordination, activeTab)}
              </p>
              <p className="truncate text-xs font-medium text-slate-500">Operação industrial</p>
            </div>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <Navigation {...navigation} activeTab={activeTab} onTabChange={onTabChange} />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden max-w-56 min-w-0 border-l border-white/[0.08] pl-4 lg:block">
              <p className="truncate text-xs font-extrabold text-slate-200">{user.name}</p>
              <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {contextLabel}{!isCoordination && lineLabel ? ` · ${lineLabel}` : ''}
              </p>
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
          <Navigation
            {...navigation}
            activeTab={activeTab}
            onTabChange={onTabChange}
            compact
          />

          <div
            className="max-w-28 truncate rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-right text-xs font-bold text-slate-300 min-[420px]:max-w-44"
            title={!isCoordination && lineLabel ? `${contextLabel} · ${lineLabel}` : contextLabel}
          >
            {isCoordination ? 'Acesso global' : lineLabel || contextLabel}
          </div>
        </div>
      </div>
    </header>
  );
};
