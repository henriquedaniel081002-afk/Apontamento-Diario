import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { User } from './types';
import { authService } from './services/authService';
import {
  INACTIVITY_TIMEOUT_MS,
  hasSessionTimedOut,
  markSessionActivity,
  notifySessionExpired,
  readLastActivity,
} from './services/sessionStore';
import { LoginPage } from './pages/LoginPage';
import { ApontamentoPage } from './pages/ApontamentoPage';
import { HistoricoPage } from './pages/HistoricoPage';
import { CoordenacaoPage } from './pages/CoordenacaoPage';
import { Header } from './components/common/Header';

type AppTab = 'apontamento' | 'historico';

const INACTIVITY_MESSAGE = 'Sessão encerrada após 1 hora sem atividade. Entre novamente.';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('apontamento');
  const [isInitializing, setIsInitializing] = useState(true);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authService.onSessionExpired(({ message }) => {
      setCurrentUser(null);
      setActiveTab('apontamento');
      setLoginMessage(message);
    });

    const storedUser = authService.getCurrentUser();

    if (storedUser && hasSessionTimedOut()) {
      notifySessionExpired(INACTIVITY_MESSAGE);
    } else {
      setCurrentUser(storedUser);
    }

    setIsInitializing(false);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: number | undefined;
    let lastPointerMoveUpdate = 0;

    function expireSession() {
      notifySessionExpired(INACTIVITY_MESSAGE);
    }

    function handleTimeout() {
      if (hasSessionTimedOut()) {
        expireSession();
        return;
      }

      scheduleTimeout();
    }

    function scheduleTimeout() {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);

      const lastActivity = readLastActivity();
      if (lastActivity === null) {
        expireSession();
        return;
      }

      const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) {
        expireSession();
        return;
      }

      timeoutId = window.setTimeout(handleTimeout, remaining);
    }

    const registerActivity = () => {
      if (hasSessionTimedOut()) {
        expireSession();
        return;
      }

      markSessionActivity();
      scheduleTimeout();
    };

    const handlePointerMove = () => {
      const now = Date.now();
      if (now - lastPointerMoveUpdate < 30_000) return;
      lastPointerMoveUpdate = now;
      registerActivity();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') registerActivity();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true });
    });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('focus', registerActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    scheduleTimeout();

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity);
      });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('focus', registerActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('apontamento');
    setLoginMessage(null);
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setActiveTab('apontamento');
    setLoginMessage(null);
  };

  if (isInitializing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#050806] text-sm font-semibold text-slate-400"
      >
        <LoaderCircle className="size-6 animate-spin text-emerald-300" aria-hidden="true" />
        <span>Carregando sistema ITAM...</span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        authLogin={authService.login}
        initialMessage={loginMessage}
      />
    );
  }

  const isCoordenacao = currentUser.perfil === 'COORDENACAO';

  return (
    <div className="flex min-h-screen flex-col bg-transparent font-sans text-slate-100 antialiased selection:bg-emerald-400/20 selection:text-emerald-50">
      <Header
        user={currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      <main id="conteudo-principal" className="flex-1 pb-12">
        {isCoordenacao ? (
          <CoordenacaoPage user={currentUser} />
        ) : activeTab === 'apontamento' ? (
          <ApontamentoPage
            user={currentUser}
            onNavigateToHistory={() => setActiveTab('historico')}
          />
        ) : (
          <HistoricoPage user={currentUser} />
        )}
      </main>

      <footer className="border-t border-emerald-300/[0.06] bg-[#030605] px-4 py-4 text-center text-xs text-slate-600">
        <p>ITAM — Sistema de Apontamento Diário de Produção © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
