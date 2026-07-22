import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { 
  Wallet, 
  Shield, 
  Clock, 
  Zap, 
  Plus, 
  ArrowUpRight, 
  Copy, 
  Check, 
  ExternalLink, 
  ChevronRight, 
  Send,
  Lock,
  Calendar
} from 'lucide-react';
import { VaultConfig, Proposal, TokenBalance } from '../../types';
import { formatAmount, formatUSD, truncateAddress } from '../../lib/stellar';

interface DashboardProps {
  vaultConfig: VaultConfig | null;
  vaultBalance: TokenBalance[];
  proposals: Proposal[];
  pendingCount: number;
  approvedCount: number;
  isSigner: boolean;
  onViewTransactions: () => void;
  onNewTransaction: () => void;
  onSelectProposal?: (proposalId: number) => void;
  vaultAddress?: string | null;
  onDeposit?: () => void;
}

const getStatusLabel = (status: number, t: TFunction): string => {
  switch (status) {
    case 0: return t('dashboard.status.pending');
    case 1: return t('dashboard.status.approved');
    case 2: return t('dashboard.status.executed');
    case 3: return t('dashboard.status.rejected');
    default: return t('dashboard.status.unknown');
  }
};

const getProposalTypeLabel = (type: number, t: TFunction): string => {
  switch (type) {
    case 0: return t('dashboard.types.transfer');
    case 1: return t('dashboard.types.timeLock');
    case 2: return t('dashboard.types.vesting');
    default: return t('dashboard.types.unknown');
  }
};

const getProposalIcon = (type: number, status: number) => {
  if (status === 2) return <Check className="w-4 h-4" />;
  if (status === 1) return <Zap className="w-4 h-4" />;
  if (type === 1) return <Lock className="w-4 h-4" />;
  if (type === 2) return <Calendar className="w-4 h-4" />;
  return <Send className="w-4 h-4" />;
};

export const Dashboard: React.FC<DashboardProps> = ({
  vaultConfig,
  vaultBalance,
  proposals,
  pendingCount,
  approvedCount,
  isSigner,
  onViewTransactions,
  onNewTransaction,
  onSelectProposal,
  vaultAddress,
  onDeposit
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getExplorerUrl = (address: string) => {
    return `https://stellar.expert/explorer/testnet/account/${address}`;
  };

  // Filter active proposals (pending or approved but not executed/rejected)
  const activeProposals = proposals.filter(
    (p) => Number(p.status) === 0 || Number(p.status) === 1
  );

  return (
    <div className="space-y-6">
      {/* Vault Status Banner */}
      {vaultAddress && (
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Vault Active
              </span>
              <span className="text-xs text-gray-500 font-medium">Stellar Testnet</span>
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {vaultConfig?.name || 'Stellar Vault'}
            </h1>
            <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm font-mono bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5 w-fit">
              <span>{truncateAddress(vaultAddress)}</span>
              <button 
                onClick={() => handleCopy(vaultAddress)}
                className="text-gray-500 hover:text-cyan-400 transition"
                title="Copy Address"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <a 
                href={getExplorerUrl(vaultAddress)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-500 hover:text-cyan-400 transition ml-1"
                title="View on Explorer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onDeposit && (
              <button
                onClick={onDeposit}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 rounded-xl transition font-medium text-sm"
              >
                <ArrowUpRight className="w-4 h-4 text-cyan-400" />
                <span>Deposit Funds</span>
              </button>
            )}
            {isSigner && (
              <button
                onClick={onNewTransaction}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl transition font-semibold text-sm shadow-lg shadow-cyan-500/10"
              >
                <Plus className="w-4 h-4" />
                <span>New Transfer</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance Card */}
        <div className="p-6 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t('dashboard.stats.totalBalance')}</p>
            <p className="text-2xl font-bold text-white leading-tight">
              {vaultBalance.length > 0 ? formatAmount(vaultBalance[0].balance) : '0.00'}
              <span className="text-sm font-medium text-gray-500 ml-1.5">{vaultBalance[0]?.symbol || 'XLM'}</span>
            </p>
            <p className="text-gray-500 text-xs">
              ≈ {vaultBalance.length > 0 ? formatUSD(vaultBalance[0].balance) : '$0.00'}
            </p>
          </div>
        </div>

        {/* Policy / Threshold Card */}
        <div className="p-6 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t('dashboard.stats.threshold')}</p>
            <p className="text-2xl font-bold text-white leading-tight">
              {vaultConfig?.threshold || 0}
              <span className="text-sm font-medium text-gray-500 ml-1.5">/ {vaultConfig?.signer_count || 0}</span>
            </p>
            <p className="text-gray-500 text-xs">{t('dashboard.stats.signaturesRequired')}</p>
          </div>
        </div>

        {/* Pending Approvals Card */}
        <div className="p-6 rounded-2xl bg-amber-500/[0.02] backdrop-blur-md border border-amber-500/10 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.06)] transition-all duration-300 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 animate-pulse-slow">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t('dashboard.stats.pending')}</p>
            <p className="text-2xl font-bold text-amber-400 leading-tight">{pendingCount}</p>
            <p className="text-gray-500 text-xs">{t('dashboard.stats.awaitingApproval')}</p>
          </div>
        </div>

        {/* Ready to Execute Card */}
        <div className="p-6 rounded-2xl bg-cyan-500/[0.02] backdrop-blur-md border border-cyan-500/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{t('dashboard.stats.readyToExecute')}</p>
            <p className="text-2xl font-bold text-cyan-400 leading-tight">{approvedCount}</p>
            <p className="text-gray-500 text-xs">{t('dashboard.stats.fullyApproved')}</p>
          </div>
        </div>
      </div>

      {/* Main Content Sections: 2 Columns Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Active Transactions */}
        <div className="lg:col-span-2 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.2)] flex flex-col">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">{t('dashboard.activeProposals')}</h2>
              <p className="text-xs text-gray-500 mt-1">Multi-sig transactions awaiting action</p>
            </div>
            <button
              onClick={onViewTransactions}
              className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1.5 group font-medium transition"
            >
              <span>{t('dashboard.viewAll')}</span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition" />
            </button>
          </div>

          {activeProposals.length === 0 ? (
            <div className="p-12 text-center flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 text-gray-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <Send className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium mb-1">All Caught Up!</p>
              <p className="text-xs text-gray-500 mb-4">No active multi-signature proposals found.</p>
              {isSigner && (
                <button
                  onClick={onNewTransaction}
                  className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-xl transition text-xs font-semibold"
                >
                  {t('dashboard.createFirst')}
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/5 flex-1">
              {activeProposals.slice(0, 5).map((proposal) => {
                const status = Number(proposal.status);
                const proposalType = Number(proposal.proposal_type || 0);
                const statusLabel = getStatusLabel(status, t);
                const typeLabel = getProposalTypeLabel(proposalType, t);

                return (
                  <div 
                    key={proposal.id} 
                    className="p-5 hover:bg-white/[0.01] transition cursor-pointer flex items-center justify-between group"
                    onClick={() => onSelectProposal?.(proposal.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        status === 2 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        status === 3 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        status === 1 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse-slow' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {getProposalIcon(proposalType, status)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white group-hover:text-cyan-400 transition leading-normal">
                          {t('dashboard.proposalLine', {
                            type: typeLabel,
                            amount: formatAmount(BigInt(proposal.amount.toString())),
                          })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                          <span>{t('dashboard.toRecipient', { address: '' })}</span> 
                          <span className="font-mono text-gray-400 bg-white/[0.02] border border-white/5 px-1.5 py-0.5 rounded text-[10px]">{truncateAddress(proposal.recipient)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-xs font-semibold uppercase tracking-wider ${
                          status === 2 ? 'text-emerald-400' :
                          status === 3 ? 'text-rose-400' :
                          status === 1 ? 'text-cyan-400' :
                          'text-amber-400'
                        }`}>
                          {statusLabel}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-16 bg-white/5 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${status === 1 ? 'bg-cyan-400' : 'bg-amber-400'}`}
                              style={{ width: `${Math.min(100, ((proposal.approvals?.length || 0) / (vaultConfig?.threshold || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono font-medium">
                            {proposal.approvals?.length || 0}/{vaultConfig?.threshold || 1}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-cyan-400 transition transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (1/3): Treasury Breakdown */}
        <div className="space-y-6">
          {/* Treasury Balances */}
          <div className="rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.2)] p-6">
            <h2 className="text-base font-bold text-white mb-4">Vault Treasury</h2>
            <div className="space-y-3">
              {vaultBalance.length === 0 ? (
                <p className="text-sm text-gray-500">No assets detected in treasury.</p>
              ) : (
                vaultBalance.map((asset) => (
                  <div 
                    key={asset.address || 'native'} 
                    className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center font-bold text-sm text-cyan-400 border border-cyan-500/10">
                        {asset.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white leading-normal">{asset.symbol}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                          {asset.address ? truncateAddress(asset.address) : 'Stellar Native'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-white leading-normal">{formatAmount(asset.balance)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        ≈ {formatUSD(asset.balance)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.2)] p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Vault Analytics</h2>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-500">Active Proposals</span>
                <span className="text-white font-semibold font-mono">{activeProposals.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-500">Total Vault Members</span>
                <span className="text-white font-semibold font-mono">{vaultConfig?.signer_count || 0}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Total Proposals Created</span>
                <span className="text-white font-semibold font-mono">{proposals.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
