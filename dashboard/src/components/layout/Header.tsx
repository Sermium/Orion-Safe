import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ChevronRight, 
  RefreshCw, 
  Plus, 
  Send, 
  Bell, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  X,
  Lock,
  Calendar
} from 'lucide-react';
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
  proposals?: any[];
  locks?: any[];
  onSelectProposal?: (proposalId: number) => void;
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
  proposals = [],
  locks = [],
  onSelectProposal
}) => {
  const { t } = useTranslation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close notifications on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      default: return view;
    }
  };

  // Compile list of notifications from current state
  const notifications = useMemo(() => {
    const list: Array<{ id: string; title: string; desc: string; type: 'info' | 'success' | 'warning' | 'pending'; timeStr: string; timestamp: number; proposalId?: number }> = [];

    // Map active/recent proposals
    proposals.forEach(p => {
      const status = Number(p.status);
      const isPending = status === 0;
      const isApproved = status === 1;
      const isExecuted = status === 2;
      const isRejected = status === 3;
      const amountFormatted = p.amount ? (Number(p.amount) / 10000000).toFixed(2) : '0';

      const time = p.created_at ? p.created_at : Math.floor(Date.now() / 1000);
      const timeStr = p.created_at 
        ? new Date(p.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';

      if (isPending) {
        list.push({
          id: `p-pending-${p.id}`,
          title: `New Proposal #${p.id}`,
          desc: `Awaiting approvals for ${amountFormatted} XLM transfer.`,
          type: 'pending',
          timeStr,
          timestamp: time,
          proposalId: p.id
        });
      } else if (isApproved) {
        list.push({
          id: `p-approved-${p.id}`,
          title: `Proposal #${p.id} Ready`,
          desc: `Threshold met! Ready to be executed.`,
          type: 'info',
          timeStr,
          timestamp: time,
          proposalId: p.id
        });
      } else if (isExecuted) {
        list.push({
          id: `p-executed-${p.id}`,
          title: `Proposal #${p.id} Executed`,
          desc: `Transaction successfully completed on Stellar.`,
          type: 'success',
          timeStr,
          timestamp: time,
          proposalId: p.id
        });
      } else if (isRejected) {
        list.push({
          id: `p-rejected-${p.id}`,
          title: `Proposal #${p.id} Rejected`,
          desc: `The proposal was cancelled or rejected.`,
          type: 'warning',
          timeStr,
          timestamp: time,
          proposalId: p.id
        });
      }
    });

    // Map recent locks
    locks.slice(0, 3).forEach(l => {
      const isVesting = l.cliff_time > 0;
      const amountFormatted = l.amount ? (Number(l.amount) / 10000000).toFixed(2) : '0';
      const time = l.created_at ? Math.floor(new Date(l.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
      
      list.push({
        id: `l-${l.id}`,
        title: isVesting ? 'New Vesting Schedule' : 'New Timelock Created',
        desc: `Asset lock established for ${amountFormatted} XLM.`,
        type: 'success',
        timeStr: 'Recent',
        timestamp: time
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [proposals, locks]);

  const unreadCount = Math.max(0, notifications.length - readCount);

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      setReadCount(notifications.length);
    }
  };

  const handleNotificationClick = (proposalId?: number) => {
    setShowNotifications(false);
    if (proposalId && onSelectProposal) {
      onSelectProposal(proposalId);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'pending': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default: return <Zap className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/[0.04] border border-transparent hover:border-white/5 rounded-xl transition"
        >
          <ChevronRight className={`w-5 h-5 transform transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>
        <h1 className="text-lg font-bold">
          <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {getViewTitle(activeView)}
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/[0.04] border border-transparent hover:border-white/5 rounded-xl transition disabled:opacity-50"
          title={t('common.refresh')}
        >
          <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Notifications Bell */}
        {isInitialized && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleBellClick}
              className={`p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/[0.04] border border-transparent hover:border-white/5 rounded-xl transition ${showNotifications ? 'bg-white/[0.04] text-cyan-400 border-white/5' : ''}`}
              title="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
              )}
            </button>

            {/* Dropdown Menu */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden text-left p-2 space-y-1 animate-fade-in">
                <div className="px-3.5 py-2.5 border-b border-white/5 flex items-center justify-between">
                  <span className="font-bold text-xs text-white uppercase tracking-wider">Vault Activity</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-semibold">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                      No recent activities.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n.proposalId)}
                        className="p-3 hover:bg-white/[0.02] rounded-xl flex items-start gap-3 transition cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {getNotificationIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                          <p className="text-[10px] text-gray-500 leading-normal mt-0.5">{n.desc}</p>
                          <p className="text-[9px] text-cyan-500/60 font-medium mt-1">{n.timeStr}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isSigner && isInitialized && (
          <>
            <button
              onClick={onDeposit}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 hover:bg-white/[0.08] text-white rounded-xl transition text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.deposit')}</span>
            </button>
            <button
              onClick={onNewTransaction}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl transition text-xs font-semibold shadow-lg shadow-cyan-500/10"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.send')}</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
