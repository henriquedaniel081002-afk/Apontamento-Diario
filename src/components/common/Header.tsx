import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Gauge,
  History,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  TrendingUp,
  UserRoundX,
  X,
  type LucideIcon,
} from 'lucide-react';
import { User } from '../../types';
import logoItam from '../../assets/logo-itam.png';
import { cx } from './ui';

export type HeaderTab = 'apontamento' | 'historico' | 'dashboard' | 'aderencia-anual' | 'controle-faltas' | 'produtividade-individual' | 'atraso';

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
  collapsed: boolean;
  onTabChange: HeaderProps['onTabChange'];
}

const navigationByProfile: Record<User['perfil'], NavigationConfig> = {
  APONTADOR: {
    ariaLabel: 'Navegação principal',
    items: [
      { id: 'apontamento', label: 'Apontamento', icon: ClipboardList },
      { id: 'historico', label: 'Histórico', icon: History },
      { id: 'dashboard', label: 'Aderência Mensal', icon: BarChart3 },
    ],
  },
  COORDENACAO: {
    ariaLabel: 'Navegação da coordenação',
    items: [
      { id: 'apontamento', label: 'Registros', icon: ShieldCheck },
      { id: 'dashboard', label: 'Aderência Mensal', icon: BarChart3 },
      { id: 'aderencia-anual', label: 'Aderência Anual', icon: TrendingUp },
      { id: 'controle-faltas', label: 'Controle Faltas', icon: UserRoundX },
      { id: 'produtividade-individual', label: 'Produtividade', icon: Gauge },
      { id: 'atraso', label: 'Atraso', icon: AlertTriangle },
    ],
  },
};

function Navigation({
  activeTab,
  collapsed,
  onTabChange,
  items,
  ariaLabel,
}: NavigationProps) {
  return (
    <nav aria-label={ariaLabel} className="flex min-w-0 flex-1 flex-col gap-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cx(
              'relative flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300',
              collapsed && 'md:justify-center md:px-0',
              isActive
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200 shadow-[inset_0_0_24px_rgba(0,199,111,0.035)]'
                : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white',
            )}
          >
            {isActive && (
              <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-emerald-300" aria-hidden="true" />
            )}
            <Icon className="size-[1.1rem] shrink-0" aria-hidden="true" />
            <span className={cx('min-w-0 truncate', collapsed && 'md:sr-only')}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function getPageTitle(isCoordination: boolean, activeTab: HeaderTab): string {
  if (isCoordination) {
    if (activeTab === 'dashboard') return 'Aderência Mensal';
    if (activeTab === 'aderencia-anual') return 'Aderência Anual';
    if (activeTab === 'controle-faltas') return 'Controle de Faltas';
    if (activeTab === 'produtividade-individual') return 'Produtividade Individual';
    if (activeTab === 'atraso') return 'Controle de Atrasos';
    return 'Coordenação';
  }
  if (activeTab === 'dashboard') return 'Aderência Mensal';
  return activeTab === 'apontamento' ? 'Apontamento diário' : 'Histórico';
}

export const Header: React.FC<HeaderProps> = ({ user, activeTab, onTabChange, onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCoordination = user.perfil === 'COORDENACAO';
  const lineLabel = user.linhas.join(' / ');
  const contextLabel = isCoordination
    ? 'Acesso global'
    : user.setor === 'CORTE LASER'
      ? 'Corte do Laser/Ferragem'
      : user.setor === 'MONTAGEM NUCLEO'
        ? 'Montagem do Núcleo/Corte do Núcleo'
        : user.setor || 'Setor não informado';
  const navigation = navigationByProfile[user.perfil];

  const handleNavigation = (tab: HeaderTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  return (
    <>
      <a
        href="#conteudo-principal"
        className="fixed left-3 top-3 z-[70] inline-flex min-h-11 -translate-y-24 items-center rounded-lg bg-emerald-300 px-3 py-2.5 text-sm font-extrabold text-emerald-950 shadow-lg transition-transform focus:translate-y-0 focus:outline-none"
      >
        Pular para o conteúdo
      </a>

      <div className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-emerald-300/[0.08] bg-[#040806]/94 px-4 shadow-[0_12px_40px_rgba(0,0,0,0.26)] backdrop-blur-2xl md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir barra lateral"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <img src={logoItam} alt="ITAM Transformadores" className="h-9 w-auto max-w-[96px] object-contain" />
        <div className="min-w-0 border-l border-white/10 pl-3">
          <p className="truncate text-sm font-extrabold text-white">{getPageTitle(isCoordination, activeTab)}</p>
          <p className="truncate text-xs font-medium text-slate-500">Operação industrial</p>
        </div>
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar barra lateral"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,calc(100vw-2rem))] shrink-0 flex-col border-r border-emerald-300/[0.10] bg-[#040806]/98 shadow-[18px_0_55px_rgba(0,0,0,0.32)] backdrop-blur-2xl transition-[width,transform] duration-200 md:sticky md:top-0 md:z-40 md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'md:w-20' : 'md:w-72',
        )}
      >
        <div className="flex min-h-[4.75rem] items-center gap-3 border-b border-white/[0.07] px-4">
          <img
            src={logoItam}
            alt="ITAM Transformadores"
            className={cx('h-10 w-auto max-w-[124px] object-contain', collapsed && 'md:hidden')}
          />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar barra lateral"
            className="ml-auto flex size-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className={cx(
              'ml-auto hidden size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-slate-400 transition-colors hover:border-white/15 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 md:flex',
              collapsed && 'md:mx-auto',
            )}
          >
            {collapsed
              ? <PanelLeftOpen className="size-[1.1rem]" aria-hidden="true" />
              : <PanelLeftClose className="size-[1.1rem]" aria-hidden="true" />}
          </button>
        </div>

        <div className={cx('min-w-0 px-3 py-4', collapsed && 'md:px-2')}>
          <p className={cx('px-2 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-slate-600', collapsed && 'md:sr-only')}>
            Navegação
          </p>
        </div>

        <div className={cx('flex min-h-0 flex-1 px-3 pb-4', collapsed && 'md:px-2')}>
          <Navigation
            {...navigation}
            activeTab={activeTab}
            collapsed={collapsed}
            onTabChange={handleNavigation}
          />
        </div>

        <div className={cx('border-t border-white/[0.07] p-3', collapsed && 'md:p-2')}>
          <div
            className={cx(
              'mb-2 min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3',
              collapsed && 'md:flex md:justify-center md:px-0',
            )}
            title={collapsed ? `${user.name} · ${contextLabel}${!isCoordination && lineLabel ? ` · ${lineLabel}` : ''}` : undefined}
          >
            <div className={cx('min-w-0', collapsed && 'md:sr-only')}>
              <p className="truncate text-xs font-extrabold text-slate-200">{user.name}</p>
              <p className="mt-1 truncate text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {contextLabel}{!isCoordination && lineLabel ? ` · ${lineLabel}` : ''}
              </p>
            </div>
            <span className={cx('hidden size-8 items-center justify-center rounded-lg bg-emerald-400/10 text-xs font-black text-emerald-300', collapsed && 'md:flex')} aria-hidden="true">
              {user.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'U'}
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title={collapsed ? 'Sair do sistema' : undefined}
            aria-label="Sair do sistema"
            className={cx(
              'flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-bold text-slate-400 transition-colors hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300',
              collapsed && 'md:justify-center md:px-0',
            )}
          >
            <LogOut className="size-[1.1rem] shrink-0" aria-hidden="true" />
            <span className={cx(collapsed && 'md:sr-only')}>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
};
