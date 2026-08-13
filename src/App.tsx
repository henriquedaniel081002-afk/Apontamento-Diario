import React, { useState, useEffect } from 'react';
import { User } from './types';
import { authService } from './services/authService';
import { LoginPage } from './pages/LoginPage';
import { ApontamentoPage } from './pages/ApontamentoPage';
import { HistoricoPage } from './pages/HistoricoPage';
import { CoordenacaoPage } from './pages/CoordenacaoPage';
import { Header } from './components/common/Header';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'apontamento' | 'historico'>('apontamento');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    setIsInitializing(false);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('apontamento');
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setActiveTab('apontamento');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#050806] flex items-center justify-center text-slate-500 text-xs font-semibold">
        Carregando sistema ITAM...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        authLogin={authService.login}
      />
    );
  }

  const isCoordenacao = currentUser.perfil === 'COORDENACAO';

  return (
    <div className="min-h-screen bg-[#050806] text-slate-100 font-sans flex flex-col antialiased selection:bg-emerald-500/15 selection:text-emerald-100">
      <Header
        user={currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 pb-12">
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

      <footer className="border-t border-white/10 bg-[#070B08] py-4 text-center text-xs text-slate-600">
        <p>ITAM — Sistema de Apontamento Diário de Produção &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
