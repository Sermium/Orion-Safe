import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon, RefreshIcon, PlusIcon, SendIcon } from '../icons';
import { ActiveView } from '../../types';

interface HeaderProps {
  activeView: ActiveView;
  loading: boolean;
  sidebarCollapsed: boolean;
  isSigner: boolean;
  isInitialized: boolean;
  onToggleSidebar: () => void;
  onRefresh: () => void;
  onDeposit: () => void;
  onNewTransaction: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  loading,
  sidebarCollapsed,
  isSigner,
  isInitialized,
  onToggleSidebar,
  onRefresh,
  onDeposit,
  onNewTransaction,
}) => {
  const { t } = useTranslation();

  const getViewTitle = (view: ActiveView): string => {
    switch (view) {
      case 'dashboard': return t('nav.dashboard');
      case 'assets': return t('nav.assets');
      case 'transactions': return t('nav.transactions');
      case 'members': return t('nav.members');
      case 'contacts': return t('nav.contacts');
      case 'admin': return t('nav.admin');
      case 'settings': return t('nav.settings');
      case 'locks': return t('header.timeLocks');
      case 'vesting': return t('nav.vesting');
      case 'docs': return t('nav.docs');
      case 'fiat': return t('nav.fiat');
      default: return view; // exhaustive: `view` is `never` here
    }
  };

  return (
    <header className="h-16 border-b border-gray-800/50 px-6 flex items-center justify-between bg-[#0a0e1a]/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-800/50 rounded-lg transition"
        >
          <ChevronRightIcon className={`transform transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>
        <h1 className="text-xl font-semibold">
          <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {getViewTitle(activeView)}
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-800/50 rounded-lg transition disabled:opacity-50"
          title={t('common.refresh')}
        >
          <RefreshIcon className={loading ? 'animate-spin' : ''} />
        </button>
        {isSigner && isInitialized && (
          <>
            <button
              onClick={onDeposit}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700/50 hover:border-cyan-500/30 hover:bg-gray-800 rounded-lg transition"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.deposit')}</span>
            </button>
            <button
              onClick={onNewTransaction}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg font-medium transition shadow-lg shadow-cyan-500/20"
            >
              <SendIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.send')}</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
