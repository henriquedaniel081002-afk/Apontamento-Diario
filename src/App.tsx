import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { User } from './types';
import { authService } from './services/authService';
import { LoginPage } from './pages/LoginPage';
import { ApontamentoPage } from './pages/ApontamentoPage';
import { HistoricoPage } from './pages/HistoricoPage';
import { CoordenacaoPage } from './pages/CoordenacaoPage';
import { Header } from './components/common/Header';

type AppTab = 'apontamento' | 'historico';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('apontamento');
  const [isInitializing, setIsInitializing] = useState(true);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(authService.getCurrentUser());
    setIsInitializing(false);

    return authService.onSessionExpired(({ message }) => {
      setCurrentUser(null);
      setActiveTab('apontamento');
      setLoginMessage(message);
    });
  }, []);

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
    <div className="flex min-h-screen flex-col bg-[#050806] font-sans text-slate-100 antialiased selection:bg-emerald-400/20 selection:text-emerald-50">
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

      <footer className="border-t border-white/[0.08] bg-[#070b08] px-4 py-4 text-center text-xs text-slate-500">
        <p>ITAM — Sistema de Apontamento Diário de Produção © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
