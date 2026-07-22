import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { 
  Copy, 
  Check, 
  UserPlus, 
  Search, 
  Shield, 
  Users, 
  AlertCircle, 
  X,
  UserCheck
} from 'lucide-react';
import { VaultConfig, Role, SignerWithRole } from '../../types';
import { truncateAddress } from '../../lib/utils';
import { getContacts, saveContact, Contact, getContactByAddress } from '../../services/contactsService';

interface MembersProps {
  signers: string[];
  signersWithRoles?: SignerWithRole[];
  vaultConfig: VaultConfig | null;
  publicKey: string | null;
  userRole?: Role;
  onCopy: (text: string) => void;
}

export const Members: React.FC<MembersProps> = ({
  signers,
  signersWithRoles,
  vaultConfig,
  publicKey,
  userRole,
  onCopy,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>(getContacts());

  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [addedToContacts, setAddedToContacts] = useState<string[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const getSignerRole = (address: string): Role => {
    const found = signersWithRoles?.find(s => s.address === address);
    return found?.role || 'Executor';
  };

  const getRoleLabel = (role: Role): string => {
    switch (role) {
      case 'SuperAdmin': return t('members.roles.superAdmin');
      case 'Admin': return t('members.roles.admin');
      case 'Executor': return t('members.roles.executor');
      default: return t('common.unknown');
    }
  };

  const getRoleBadgeStyle = (role: Role) => {
    switch (role) {
      case 'SuperAdmin':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.05)]';
      case 'Admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.05)]';
      case 'Executor':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.05)]';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const isInContacts = (address: string): boolean => {
    return contacts.some(c => c.address === address) || addedToContacts.includes(address);
  };

  const handleAddToContacts = () => {
    if (!contactName.trim() || !selectedAddress) return;

    const newContact: Contact = {
      id: Date.now().toString(),
      address: selectedAddress,
      name: contactName.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveContact(newContact);
    setContacts(getContacts());
    setAddedToContacts([...addedToContacts, selectedAddress]);
    setShowAddContactModal(false);
    setContactName('');
    setSelectedAddress('');
  };

  const handleCopyClick = (address: string) => {
    onCopy(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const filteredSigners = signers.filter(signer => {
    if (!searchQuery) return true;
    const contact = getContactByAddress(signer);
    const searchLower = searchQuery.toLowerCase();
    return (
      signer.toLowerCase().includes(searchLower) ||
      contact?.name?.toLowerCase().includes(searchLower) ||
      getSignerRole(signer).toLowerCase().includes(searchLower)
    );
  });

  const superAdminCount = signersWithRoles?.filter(s => s.role === 'SuperAdmin').length || 0;
  const adminCount = signersWithRoles?.filter(s => s.role === 'Admin').length || 0;
  const executorCount = signersWithRoles?.filter(s => s.role === 'Executor').length || 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{t('members.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {t('members.subtitle', {
              count: signers.length,
              threshold: vaultConfig?.threshold || 1,
              total: signers.length,
            })}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/10">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t('members.stats.totalMembers')}</p>
            <p className="text-xl font-bold text-white mt-0.5">{signers.length}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/10">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t('members.stats.superAdmins')}</p>
            <p className="text-xl font-bold text-amber-400 mt-0.5">{superAdminCount}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/10">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t('members.stats.admins')}</p>
            <p className="text-xl font-bold text-purple-400 mt-0.5">{adminCount}</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/10">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t('members.stats.executors')}</p>
            <p className="text-xl font-bold text-blue-400 mt-0.5">{executorCount}</p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder={t('members.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-4 pl-12 rounded-xl bg-white/[0.02] border border-white/10 focus:border-cyan-500/30 focus:outline-none focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm transition"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
      </div>

      {/* Hint Alert */}
      <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm flex items-start gap-2.5 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
        <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-xs sm:text-sm">
          <Trans
            i18nKey="members.manageHint"
            components={{ strong: <strong className="font-semibold text-cyan-300" /> }}
          />
        </div>
      </div>

      {/* Signers List */}
      <div className="rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.2)] overflow-hidden">
        <div className="divide-y divide-white/5">
          {filteredSigners.map((signer) => {
            const role = getSignerRole(signer);
            const contact = getContactByAddress(signer);
            const isCurrentUser = signer === publicKey;
            const isCopied = copiedAddress === signer;

            return (
              <div
                key={signer}
                className={`p-5 flex items-center justify-between gap-4 transition duration-300 hover:bg-white/[0.01] ${isCurrentUser ? 'bg-cyan-500/5' : ''}`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 text-white ${
                    role === 'SuperAdmin'
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : role === 'Admin'
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                      : 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                  }`}>
                    {contact?.name?.charAt(0).toUpperCase() || signer.slice(2, 4).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {contact ? (
                        <>
                          <p className="font-semibold text-white truncate max-w-[150px] sm:max-w-none text-sm">{contact.name}</p>
                          <p className="text-xs text-gray-500 font-mono">({truncateAddress(signer)})</p>
                        </>
                      ) : (
                        <p className="font-mono text-sm text-white">{truncateAddress(signer)}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      {isCurrentUser && (
                        <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/10 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> {t('members.you')}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(role)}`}>
                        {getRoleLabel(role)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isInContacts(signer) && (
                    <button
                      onClick={() => {
                        setSelectedAddress(signer);
                        setShowAddContactModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/[0.04] border border-transparent hover:border-white/5 rounded-xl transition"
                      title={t('members.addToContacts')}
                    >
                      <UserPlus className="w-4.5 h-4.5" />
                    </button>
                  )}

                  <button
                    onClick={() => handleCopyClick(signer)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/5 rounded-xl transition"
                    title={t('common.copyAddress')}
                  >
                    {isCopied ? <Check className="w-4.5 h-4.5 text-emerald-400" /> : <Copy className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredSigners.length === 0 && (
            <div className="p-12 text-center text-gray-500 text-sm">
              {t('members.noResults')}
            </div>
          )}
        </div>
      </div>

      {/* Permissions Guide Panel */}
      <div className="rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 p-6 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <h3 className="text-base font-bold text-white mb-4">{t('members.permissions.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-amber-500/[0.02] border border-amber-500/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                {t('members.roles.superAdmin')}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{t('members.permissions.superAdmin')}</p>
          </div>

          <div className="p-4 rounded-xl bg-purple-500/[0.02] border border-purple-500/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
                {t('members.roles.admin')}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{t('members.permissions.admin')}</p>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/[0.02] border border-blue-500/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                {t('members.roles.executor')}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{t('members.permissions.executor')}</p>
          </div>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{t('members.addContactModal.title')}</h3>
              <button
                onClick={() => {
                  setShowAddContactModal(false);
                  setContactName('');
                  setSelectedAddress('');
                }}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('members.addContactModal.addressLabel')}</label>
                <p className="font-mono text-xs bg-white/[0.02] border border-white/5 p-3 rounded-xl break-all text-gray-300">
                  {selectedAddress}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('members.addContactModal.nameLabel')}</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder={t('members.addContactModal.namePlaceholder')}
                  className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/10 focus:border-cyan-500/30 focus:outline-none focus:shadow-[0_0_15px_rgba(6,182,212,0.05)] text-sm text-white"
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowAddContactModal(false);
                  setContactName('');
                  setSelectedAddress('');
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 transition text-sm font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddToContacts}
                disabled={!contactName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white transition text-sm font-semibold shadow-lg shadow-cyan-500/10"
              >
                {t('members.addContactModal.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
