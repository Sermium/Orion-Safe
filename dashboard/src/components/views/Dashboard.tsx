import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SendIcon, CheckIcon, ZapIcon, ClockIcon, ChevronRightIcon, ShieldIcon } from '../icons';
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
}

// On passe `t` pour garder ces helpers purs et traduits.
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
  if (status === 2) return <CheckIcon />;
  if (status === 1) return <ZapIcon />;
  if (type === 1) return <ShieldIcon />; // Time Lock
  if (type === 2) return <ClockIcon />;  // Vesting
  return <ClockIcon />;
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
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50">
          <p className="text-gray-400 text-sm mb-2">{t('dashboard.stats.totalBalance')}</p>
          <p className="text-3xl font-bold">
            {vaultBalance.length > 0 ? formatAmount(vaultBalance[0].balance) : '0.00'}
            <span className="text-lg text-gray-400 ml-2">XLM</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">
            ≈ {vaultBalance.length > 0 ? formatUSD(vaultBalance[0].balance) : '$0.00'}
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50">
          <p className="text-gray-400 text-sm mb-2">{t('dashboard.stats.threshold')}</p>
          <p className="text-3xl font-bold">
            {vaultConfig?.threshold || 0}
            <span className="text-lg text-gray-400">/{vaultConfig?.signer_count || 0}</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">{t('dashboard.stats.signaturesRequired')}</p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
          <p className="text-gray-400 text-sm mb-2">{t('dashboard.stats.pending')}</p>
          <p className="text-3xl font-bold text-yellow-400">{pendingCount}</p>
          <p className="text-gray-500 text-sm mt-1">{t('dashboard.stats.awaitingApproval')}</p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
          <p className="text-gray-400 text-sm mb-2">{t('dashboard.stats.readyToExecute')}</p>
          <p className="text-3xl font-bold text-cyan-400">{approvedCount}</p>
          <p className="text-gray-500 text-sm mt-1">{t('dashboard.stats.fullyApproved')}</p>
        </div>
      </div>

      {/* Active Proposals */}
      <div className="rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50">
        <div className="p-6 border-b border-gray-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('dashboard.activeProposals')}</h2>
          <button
            onClick={onViewTransactions}
            className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
          >
            {t('dashboard.viewAll')} <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>

        {proposals.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <SendIcon />
            </div>
            <p className="text-gray-400 mb-4">{t('dashboard.noProposals')}</p>
            {isSigner && (
              <button
                onClick={onNewTransaction}
                className="text-cyan-400 hover:text-cyan-300"
              >
                {t('dashboard.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {proposals.filter(p => Number(p.status) === 0 || Number(p.status) === 1).slice(0, 5).map((proposal) => {
              const status = Number(proposal.status);
              const proposalType = Number(proposal.proposal_type || 0);
              const statusLabel = getStatusLabel(status, t);
              const typeLabel = getProposalTypeLabel(proposalType, t);

              return (
                <div 
                  key={proposal.id} 
                  className="p-4 hover:bg-gray-800/30 transition cursor-pointer"
                  onClick={() => onSelectProposal?.(proposal.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        status === 2 ? 'bg-green-500/20 text-green-400' :
                        status === 3 ? 'bg-red-500/20 text-red-400' :
                        status === 1 ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {getProposalIcon(proposalType, status)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {t('dashboard.proposalLine', {
                            type: typeLabel,
                            amount: formatAmount(BigInt(proposal.amount.toString())),
                          })}
                        </p>
                        <p className="text-sm text-gray-400">
                          {t('dashboard.toRecipient', { address: truncateAddress(proposal.recipient) })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        status === 2 ? 'text-green-400' :
                        status === 3 ? 'text-red-400' :
                        status === 1 ? 'text-cyan-400' :
                        'text-yellow-400'
                      }`}>
                        {statusLabel}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('dashboard.approvalsCount', {
                          count: proposal.approvals?.length || 0,
                          threshold: vaultConfig?.threshold || 1,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
