import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getContacts, Contact } from '../../services/contactsService';
import { Plus, Trash2, Upload, Download, AlertCircle, CheckCircle, Loader2, X, Copy } from 'lucide-react';

// Constants for batch limits
const MAX_BATCH_SIZE = 10;
const BATCH_DELAY_MS = 3000;

// CSV Example Template — on garde les en-têtes en anglais (le parser s'appuie dessus)
const CSV_TIMELOCK_EXAMPLE = `# Bulk Time Lock Template - Orion Safe
# Maximum ${MAX_BATCH_SIZE} locks per batch to avoid network overload
#
# Format: beneficiary,amount,token,unlock_date,revocable,description
# Date format: YYYY-MM-DDTHH:MM (e.g., 2026-12-31T12:00)
# revocable: true or false
#
# Example entries:
beneficiary,amount,token,unlock_date,revocable,description
GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON,1000,CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC,2026-12-31T12:00,true,Team allocation Q4
GCFONE23AB7Y6C5YZOMKPQHBLRPNXACTTBLCBHWBXM5CUUTP7M4JOZQQ,500,CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC,2027-06-15T00:00,false,Advisor lockup
GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOUJ3DCMOPJCXP6V,2500,CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC,2026-09-01T09:00,true,Marketing budget`;

interface Lock {
  id: number | bigint;
  creator: string;
  beneficiary: string;
  token: string;
  total_amount: bigint | string | number;
  released_amount: bigint | string | number;
  lock_type: 'TimeLock' | 'Vesting' | string;
  status: 'Active' | 'PartiallyReleased' | 'FullyReleased' | 'Cancelled' | string;
  created_at: number | bigint;
  start_time: number | bigint;
  end_time: number | bigint;
  cliff_time: number | bigint;
  release_intervals: number | bigint;
  revocable: boolean;
  description: string;
}

interface TokenBalance {
  symbol: string;
  balance: bigint;
  decimals: number;
  address?: string;
}

interface Proposal {
  id: number;
  token: string;
  amount: bigint | string;
  status: number | string;
}

interface BulkLockEntry {
  id: string;
  beneficiary: string;
  amount: string;
  token: string;
  unlockDate: string;
  revocable: boolean;
  description: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface LocksProps {
  vaultAddress: string | null;
  locks: Lock[];
  vaultBalance: TokenBalance[];
  proposals?: Proposal[];
  userRole?: string;
  publicKey: string | null;
  onCreateTimeLock: (
    beneficiary: string,
    token: string,
    amount: string,
    unlockTime: number,
    revocable: boolean,
    description: string
  ) => Promise<number | undefined | void>;
  onClaimLock: (lockId: number) => Promise<bigint | undefined | void>;
  onCancelLock: (lockId: number) => Promise<bigint | undefined | void>;
  onRefresh: () => void;
  preselectedToken?: string | null;
  isPublicView?: boolean;
}

function getLockTypeString(lockType: any): string {
  if (typeof lockType === 'string') return lockType;
  if (typeof lockType === 'number') return lockType === 0 ? 'TimeLock' : 'Vesting';
  if (typeof lockType === 'object' && lockType !== null) {
    const keys = Object.keys(lockType);
    if (keys.length > 0) return keys[0];
  }
  return 'Unknown';
}

function getStatusString(status: any): string {
  if (typeof status === 'string') return status;
  if (typeof status === 'number') {
    switch (status) {
      case 0: return 'Active';
      case 1: return 'PartiallyReleased';
      case 2: return 'FullyReleased';
      case 3: return 'Cancelled';
      default: return 'Unknown';
    }
  }
  if (typeof status === 'object' && status !== null) {
    const keys = Object.keys(status);
    if (keys.length > 0) return keys[0];
  }
  return 'Unknown';
}

// Libellé traduit du statut (l'identité interne reste celle de getStatusString)
function getStatusLabel(status: any, t: TFunction): string {
  const s = getStatusString(status);
  switch (s) {
    case 'Active': return t('locks.statuses.active');
    case 'PartiallyReleased': return t('locks.statuses.partiallyReleased');
    case 'FullyReleased': return t('locks.statuses.fullyReleased');
    case 'Cancelled': return t('locks.statuses.cancelled');
    default: return t('locks.statuses.unknown');
  }
}

const Locks: React.FC<LocksProps> = ({
  vaultAddress,
  locks: allLocks,
  vaultBalance,
  proposals = [],
  userRole,
  publicKey,
  onCreateTimeLock,
  onClaimLock,
  onCancelLock,
  onRefresh,
  preselectedToken,
  isPublicView = false,
}) => {
  const { t, i18n } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [selectedToken, setSelectedToken] = useState('');
  const [amount, setAmount] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [revocable, setRevocable] = useState(true);
  const [description, setDescription] = useState('');

  // Bulk modal state
  const [bulkEntries, setBulkEntries] = useState<BulkLockEntry[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkCurrentIndex, setBulkCurrentIndex] = useState(0);

  const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';
  const locks = allLocks.filter(l => getLockTypeString(l.lock_type) === 'TimeLock');

  useEffect(() => { setContacts(getContacts()); }, [showCreateModal, showBulkModal]);
  useEffect(() => { if (preselectedToken) { setSelectedToken(preselectedToken); setShowCreateModal(true); } }, [preselectedToken]);

  // Initialize bulk entries when modal opens
  useEffect(() => {
    if (showBulkModal && bulkEntries.length === 0) {
      addBulkEntry();
    }
  }, [showBulkModal]);

  const getLockId = (lock: Lock): number => typeof lock.id === 'bigint' ? Number(lock.id) : lock.id;
  const safeBigInt = (value: any): bigint => {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string') return BigInt(value || '0');
    return BigInt(0);
  };

  const formatAmount = (amt: bigint | number | string, decimals: number = 7): string => {
    try {
      const value = safeBigInt(amt);
      const divisor = BigInt(10 ** decimals);
      const whole = value / divisor;
      const fraction = value % divisor;
      return whole.toString() + '.' + fraction.toString().padStart(decimals, '0').slice(0, 4);
    } catch { return '0.0000'; }
  };

  const truncateAddress = (addr: string): string => addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';

  const getAvailableBalance = (tokenAddress: string): bigint => {
    const token = vaultBalance.find(t => t.address === tokenAddress);
    if (!token) return BigInt(0);

    const totalBalance = token.balance;
    const lockedAmount = allLocks
      .filter(l => l.token === tokenAddress && getStatusString(l.status) === 'Active')
      .reduce((sum, l) => sum + BigInt(l.total_amount || 0) - BigInt(l.released_amount || 0), BigInt(0));

    const pendingAmount = proposals
      .filter(p => p.token === tokenAddress && (Number(p.status) === 0 || Number(p.status) === 1))
      .reduce((sum, p) => sum + BigInt(p.amount || 0), BigInt(0));

    const reserved = lockedAmount + pendingAmount;
    return totalBalance > reserved ? totalBalance - reserved : BigInt(0);
  };

  const getTokenSymbol = (tokenAddress: string): string => vaultBalance.find(t => t.address === tokenAddress)?.symbol || truncateAddress(tokenAddress);
  const getTokenDecimals = (tokenAddress: string): number => vaultBalance.find(t => t.address === tokenAddress)?.decimals || 7;
  const getContactName = (address: string): string | null => contacts.find(c => c.address === address)?.name || null;
  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.address.toLowerCase().includes(contactSearch.toLowerCase()));

  const handleSelectContact = (contact: Contact) => { setBeneficiary(contact.address); setContactSearch(contact.name); setShowContactDropdown(false); };
  const handleBeneficiaryChange = (value: string) => { setBeneficiary(value); setContactSearch(value); setShowContactDropdown(value.length > 0 && !value.startsWith('G')); };

  const isAutoArchived = (lock: Lock): boolean => {
    const status = getStatusString(lock.status);
    if (status !== 'FullyReleased' && status !== 'Cancelled') return false;
    const now = Math.floor(Date.now() / 1000);
    const remaining = safeBigInt(lock.total_amount) - safeBigInt(lock.released_amount);
    if (status === 'Cancelled') return remaining <= BigInt(0) || now > Number(lock.end_time);
    return now > Number(lock.end_time);
  };

  const isLockClaimable = (lock: Lock): boolean => {
    const status = getStatusString(lock.status);
    if (status !== 'Active' && status !== 'PartiallyReleased') return false;
    return Math.floor(Date.now() / 1000) >= Number(lock.end_time);
  };

  const canUserClaim = (lock: Lock): boolean => !!(publicKey && isLockClaimable(lock) && lock.beneficiary === publicKey);
  const canUserCancel = (lock: Lock): boolean => !!(publicKey && isAdmin && lock.revocable && ['Active', 'PartiallyReleased'].includes(getStatusString(lock.status)));
  const getProgressPercent = (lock: Lock): number => { const tot = safeBigInt(lock.total_amount); return tot === BigInt(0) ? 0 : Number((safeBigInt(lock.released_amount) * BigInt(100)) / tot); };

  const getTimeRemaining = (lock: Lock): string => {
    const now = Math.floor(Date.now() / 1000);
    const target = Number(lock.end_time);
    if (now >= target) return t('locks.time.unlocked');
    const diff = target - now;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return days > 0
      ? t('locks.time.remainingDays', { days, hours })
      : t('locks.time.remainingHours', { hours });
  };

  const getStatusColor = (status: any) => {
    switch (getStatusString(status)) {
      case 'Active': return 'bg-green-500/20 text-green-400';
      case 'PartiallyReleased': return 'bg-yellow-500/20 text-yellow-400';
      case 'FullyReleased': return 'bg-blue-500/20 text-blue-400';
      case 'Cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const handleCreateLock = async () => {
    if (!selectedToken || !beneficiary || !amount) { setError(t('locks.errors.fillRequired')); return; }
    if (!beneficiary.startsWith('G') || beneficiary.length !== 56) { setError(t('locks.errors.invalidBeneficiary')); return; }
    setLoading(true); setError(null);
    try {
      const unlockTime = Math.floor(new Date(unlockDate).getTime() / 1000);
      if (unlockTime <= Math.floor(Date.now() / 1000)) { setError(t('locks.errors.unlockFuture')); setLoading(false); return; }
      await onCreateTimeLock(beneficiary, selectedToken, amount, unlockTime, revocable, description || t('locks.defaultDescription'));
      setShowCreateModal(false); resetForm(); onRefresh();
    } catch (err: any) { setError(err.message || t('locks.errors.createFailed')); } finally { setLoading(false); }
  };

  const handleClaim = async (lockId: number | bigint) => {
    setLoading(true); setError(null);
    try { await onClaimLock(typeof lockId === 'bigint' ? Number(lockId) : lockId); onRefresh(); }
    catch (err: any) { setError(err.message || t('locks.errors.claimFailed')); } finally { setLoading(false); }
  };

  const handleCancel = async (lockId: number | bigint) => {
    if (!window.confirm(t('locks.confirmCancel'))) return;
    setLoading(true); setError(null);
    try { await onCancelLock(typeof lockId === 'bigint' ? Number(lockId) : lockId); onRefresh(); }
    catch (err: any) { setError(err.message || t('locks.errors.cancelFailed')); } finally { setLoading(false); }
  };

  const resetForm = () => { setBeneficiary(''); setContactSearch(''); setSelectedToken(''); setAmount(''); setUnlockDate(''); setRevocable(true); setDescription(''); setShowContactDropdown(false); };

  // ==================== BULK MODAL FUNCTIONS ====================
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addBulkEntry = () => {
    if (bulkEntries.filter(e => e.status === 'pending').length >= MAX_BATCH_SIZE) {
      alert(t('locks.bulk.maxReachedAlert', { max: MAX_BATCH_SIZE }));
      return;
    }
    const newEntry: BulkLockEntry = {
      id: generateId(),
      beneficiary: '',
      amount: '',
      token: vaultBalance[0]?.address || '',
      unlockDate: '',
      revocable: true,
      description: '',
      status: 'pending',
    };
    setBulkEntries(prev => [...prev, newEntry]);
  };

  const removeBulkEntry = (id: string) => {
    if (bulkEntries.length > 1) {
      setBulkEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const updateBulkEntry = (id: string, field: keyof BulkLockEntry, value: any) => {
    setBulkEntries(prev => prev.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const duplicateBulkEntry = (entry: BulkLockEntry) => {
    const newEntry: BulkLockEntry = {
      ...entry,
      id: generateId(),
      beneficiary: '',
      status: 'pending',
      error: undefined,
    };
    setBulkEntries(prev => [...prev, newEntry]);
  };

  const validateBulkEntry = (entry: BulkLockEntry): string | null => {
    if (!entry.beneficiary || entry.beneficiary.length !== 56 || !entry.beneficiary.startsWith('G')) {
      return t('locks.errors.invalidBeneficiary');
    }
    if (!entry.amount || parseFloat(entry.amount) <= 0) {
      return t('locks.errors.invalidAmount');
    }
    if (!entry.token) {
      return t('locks.errors.tokenNotSelected');
    }
    if (!entry.unlockDate) {
      return t('locks.errors.unlockRequired');
    }
    if (new Date(entry.unlockDate).getTime() <= Date.now()) {
      return t('locks.errors.unlockFuture');
    }
    return null;
  };

  const handleBulkProcessAll = async () => {
    const validationErrors: { [key: string]: string } = {};
    bulkEntries.forEach(entry => {
      const err = validateBulkEntry(entry);
      if (err) {
        validationErrors[entry.id] = err;
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      setBulkEntries(prev => prev.map(e => ({
        ...e,
        status: validationErrors[e.id] ? 'error' : 'pending',
        error: validationErrors[e.id],
      })));
      return;
    }

    setBulkProcessing(true);

    for (let i = 0; i < bulkEntries.length; i++) {
      setBulkCurrentIndex(i);
      const entry = bulkEntries[i];

      setBulkEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, status: 'processing' } : e
      ));

      try {
        const unlockTime = Math.floor(new Date(entry.unlockDate).getTime() / 1000);
        await onCreateTimeLock(
          entry.beneficiary,
          entry.token,
          entry.amount,
          unlockTime,
          entry.revocable,
          entry.description || t('locks.bulk.defaultDescription')
        );

        setBulkEntries(prev => prev.map(e =>
          e.id === entry.id ? { ...e, status: 'success' } : e
        ));

        if (i < bulkEntries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      } catch (err: any) {
        setBulkEntries(prev => prev.map(e =>
          e.id === entry.id ? { ...e, status: 'error', error: err.message || t('locks.errors.proposalFailed') } : e
        ));
      }
    }

    setBulkProcessing(false);
    onRefresh();
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      const dataLines = lines[0]?.toLowerCase().includes('beneficiary') ? lines.slice(1) : lines;

      if (dataLines.length > MAX_BATCH_SIZE) {
        alert(t('locks.bulk.csvTooMany', { count: dataLines.length, max: MAX_BATCH_SIZE }));
      }

      const newEntries: BulkLockEntry[] = dataLines.slice(0, MAX_BATCH_SIZE).map(line => {
        const columns = line.split(',').map(col => col.trim());
        return {
          id: generateId(),
          beneficiary: columns[0] || '',
          amount: columns[1] || '',
          token: columns[2] || vaultBalance[0]?.address || '',
          unlockDate: columns[3] || '',
          revocable: columns[4]?.toLowerCase() !== 'false',
          description: columns[5] || '',
          status: 'pending' as const,
        };
      });

      setBulkEntries(newEntries);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportTemplate = () => {
    const blob = new Blob([CSV_TIMELOCK_EXAMPLE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_timelock_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetBulkModal = () => {
    setBulkEntries([]);
    setBulkProcessing(false);
    setBulkCurrentIndex(0);
  };

  const bulkPendingCount = bulkEntries.filter(e => e.status === 'pending').length;
  const bulkSuccessCount = bulkEntries.filter(e => e.status === 'success').length;
  const bulkErrorCount = bulkEntries.filter(e => e.status === 'error').length;

  // ==================== END BULK MODAL FUNCTIONS ====================

  const myClaimableLocks = locks.filter(l => l.beneficiary === publicKey && !isAutoArchived(l));
  const activeLocks = locks.filter(l => ['Active', 'PartiallyReleased'].includes(getStatusString(l.status)) && l.beneficiary !== publicKey);
  const archivedLocks = locks.filter(l => isAutoArchived(l));
  const pendingCompletion = locks.filter(l => ['FullyReleased', 'Cancelled'].includes(getStatusString(l.status)) && !isAutoArchived(l) && l.beneficiary !== publicKey);

  const LockCard: React.FC<{ lock: Lock; showClaimButton?: boolean; isArchived?: boolean }> = ({ lock, showClaimButton = false, isArchived = false }) => {
    const beneficiaryName = getContactName(lock.beneficiary);
    const creatorName = getContactName(lock.creator);
    const claimable = isLockClaimable(lock);
    const total = safeBigInt(lock.total_amount);
    const released = safeBigInt(lock.released_amount);
    const remaining = total - released;

    return (
      <div className={'bg-gray-800 rounded-lg p-4 ' + (isArchived ? 'opacity-60 ' : '') + (showClaimButton && claimable ? 'border-2 border-green-500/50' : '')}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-lg font-semibold text-white">{t('locks.lockNumber', { id: getLockId(lock) })}</span>
              <span className={'px-2 py-1 rounded text-xs ' + getStatusColor(lock.status)}>{getStatusLabel(lock.status, t)}</span>
              <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400">⏰ {t('locks.timeLockBadge')}</span>
              {lock.revocable && !isArchived && <span className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-400">{t('locks.revocableBadge')}</span>}
              {showClaimButton && claimable && <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 animate-pulse">✓ {t('locks.readyToClaim')}</span>}
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{t('locks.releasedLabel')}: {formatAmount(released, getTokenDecimals(lock.token))} / {formatAmount(total, getTokenDecimals(lock.token))}</span>
                <span>{getProgressPercent(lock)}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className={'h-full transition-all ' + (isArchived ? 'bg-gray-500' : showClaimButton ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-purple-500 to-pink-500')} style={{ width: getProgressPercent(lock) + '%' }} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-400">{t('locks.fields.token')}</p><p className="text-white font-medium">{getTokenSymbol(lock.token)}</p></div>
              <div><p className="text-gray-400">{t('locks.fields.remaining')}</p><p className={'font-medium ' + (remaining > BigInt(0) ? 'text-yellow-400' : 'text-gray-500')}>{formatAmount(remaining, getTokenDecimals(lock.token))}</p></div>
              <div><p className="text-gray-400">{t('locks.fields.timeStatus')}</p><p className={'font-medium ' + (claimable ? 'text-green-400' : 'text-white')}>{getTimeRemaining(lock)}</p></div>
              <div><p className="text-gray-400">{t('locks.fields.unlockDate')}</p><p className="text-white">{new Date(Number(lock.end_time) * 1000).toLocaleDateString(i18n.language)}</p></div>
              <div><p className="text-gray-400">{t('locks.fields.beneficiary')}</p>
                <div className="flex items-center gap-2">
                  {beneficiaryName ? <><span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{beneficiaryName}</span><span className="text-gray-500 text-xs">{truncateAddress(lock.beneficiary)}</span></> : <span className="text-white font-mono text-xs">{truncateAddress(lock.beneficiary)}</span>}
                  {lock.beneficiary === publicKey && <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">{t('locks.you')}</span>}
                </div>
              </div>
              <div><p className="text-gray-400">{t('locks.fields.creator')}</p>
                <div className="flex items-center gap-2">{creatorName ? <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">{creatorName}</span> : <span className="text-white font-mono text-xs">{truncateAddress(lock.creator)}</span>}</div>
              </div>
              {lock.description && <div className="col-span-2"><p className="text-gray-400">{t('locks.fields.description')}</p><p className="text-white">{lock.description}</p></div>}
            </div>
          </div>
          {!isPublicView && !isArchived && (
            <div className="flex flex-col gap-2 ml-4">
              {canUserClaim(lock) && <button onClick={() => handleClaim(lock.id)} disabled={loading} className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg text-white font-semibold disabled:opacity-50 transition-all shadow-lg shadow-green-500/25">{loading ? '...' : `💰 ${t('locks.claim')}`}</button>}
              {canUserCancel(lock) && <button onClick={() => handleCancel(lock.id)} disabled={loading} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm disabled:opacity-50 transition-colors">{t('locks.cancel')}</button>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">⏰ {t('locks.title')}</h1>
          <p className="text-gray-400 text-sm sm:text-base mt-1">{t('locks.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={onRefresh}
            className="w-full sm:w-auto px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
          >
            {t('common.refresh')}
          </button>
          {isAdmin && !isPublicView && (
            <>
              <button
                onClick={() => setShowBulkModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {t('locks.bulkCreate')}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition-colors"
              >
                + {t('locks.createTimeLock')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400">{error}<button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">✕</button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4"><p className="text-gray-400 text-sm">{t('locks.stats.total')}</p><p className="text-2xl font-bold text-white">{locks.length}</p></div>
        <div className="bg-gray-800 rounded-lg p-4"><p className="text-gray-400 text-sm">{t('locks.stats.active')}</p><p className="text-2xl font-bold text-green-400">{activeLocks.length + myClaimableLocks.filter(l => getStatusString(l.status) === 'Active').length}</p></div>
        <div className="bg-gray-800 rounded-lg p-4"><p className="text-gray-400 text-sm">{t('locks.stats.unlocked')}</p><p className="text-2xl font-bold text-purple-400">{locks.filter(l => isLockClaimable(l)).length}</p></div>
        <div className="bg-gray-800 rounded-lg p-4"><p className="text-gray-400 text-sm">{t('locks.stats.yourLocks')}</p><p className="text-2xl font-bold text-cyan-400">{locks.filter(l => l.beneficiary === publicKey).length}</p></div>
      </div>

      {myClaimableLocks.length > 0 && !isPublicView && <div className="mb-8"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="text-2xl">🎁</span>{t('locks.sections.yours')}</h2><div className="space-y-4">{myClaimableLocks.map(lock => <LockCard key={getLockId(lock)} lock={lock} showClaimButton={true} />)}</div></div>}
      {activeLocks.length > 0 && <div className="mb-8"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="text-2xl">🔒</span>{t('locks.sections.active')}</h2><div className="space-y-4">{activeLocks.map(lock => <LockCard key={getLockId(lock)} lock={lock} />)}</div></div>}
      {pendingCompletion.length > 0 && <div className="mb-8"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="text-2xl">⏳</span>{t('locks.sections.pendingCompletion')}</h2><div className="space-y-4">{pendingCompletion.map(lock => <LockCard key={getLockId(lock)} lock={lock} />)}</div></div>}

      {locks.length === 0 && <div className="bg-gray-800 rounded-lg p-8 text-center"><div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center"><span className="text-3xl">⏰</span></div><p className="text-gray-400 mb-4">{t('locks.empty')}</p>{isAdmin && !isPublicView && <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white">{t('locks.createFirst')}</button>}</div>}

      {archivedLocks.length > 0 && <div className="mt-8"><button onClick={() => setShowArchived(!showArchived)} className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"><div className="flex items-center gap-2"><span className="text-xl">📦</span><span className="text-lg font-semibold text-gray-300">{t('locks.archived')}</span><span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-sm">{archivedLocks.length}</span></div><svg className={'w-5 h-5 text-gray-400 transition-transform ' + (showArchived ? 'rotate-180' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>{showArchived && <div className="mt-4 space-y-4">{archivedLocks.map(lock => <LockCard key={getLockId(lock)} lock={lock} isArchived={true} />)}</div>}</div>}

      {/* Single Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white">⏳ {t('locks.createTimeLock')}</h2><button onClick={() => { setShowCreateModal(false); resetForm(); }} className="text-gray-400 hover:text-white">✕</button></div>
            <div className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1">{t('locks.fields.token')}</label><select value={selectedToken} onChange={e => setSelectedToken(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"><option value="">{t('locks.selectToken')}</option>{vaultBalance.map(token => <option key={token.address} value={token.address}>{token.symbol} - {t('locks.available', { amount: formatAmount(getAvailableBalance(token.address || ''), token.decimals) })}</option>)}</select></div>
              <div><label className="block text-sm text-gray-400 mb-1">{t('locks.fields.amount')}</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="any" min="0" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none" /></div>
              <div className="relative">
                <label className="block text-sm text-gray-400 mb-1">{t('locks.fields.beneficiary')}</label>
                {contacts.length > 0 && <div className="flex gap-2 mb-2 flex-wrap"><span className="text-xs text-gray-500">{t('locks.quickSelect')}</span>{contacts.slice(0,5).map(c => <button key={c.id} type="button" onClick={() => handleSelectContact(c)} className={'px-2 py-1 text-xs rounded-full transition-colors ' + (beneficiary === c.address ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600')}>{c.name}</button>)}</div>}
                <input type="text" value={beneficiary.startsWith('G') ? beneficiary : contactSearch} onChange={e => handleBeneficiaryChange(e.target.value)} onFocus={() => { if (contacts.length > 0 && !beneficiary.startsWith('G')) setShowContactDropdown(true); }} placeholder={t('locks.beneficiaryPlaceholder')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none" />
                {showContactDropdown && filteredContacts.length > 0 && <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">{filteredContacts.map(c => <button key={c.id} type="button" onClick={() => handleSelectContact(c)} className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center font-bold text-sm">{c.name.charAt(0).toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-white font-medium truncate">{c.name}</p><p className="text-gray-400 text-xs font-mono truncate">{c.address}</p></div></button>)}</div>}
                {beneficiary.startsWith('G') && <p className="text-xs text-gray-500 mt-1 font-mono truncate">{beneficiary}</p>}
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">{t('locks.fields.unlockDateTime')}</label><input type="datetime-local" value={unlockDate} onChange={e => setUnlockDate(e.target.value)} min={new Date().toISOString().slice(0,16)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">{t('locks.fields.descriptionOptional')}</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('locks.descriptionPlaceholder')} maxLength={32} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none" /></div>
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg"><input type="checkbox" id="revocable" checked={revocable} onChange={e => setRevocable(e.target.checked)} className="w-4 h-4 rounded" /><label htmlFor="revocable" className="text-gray-300 flex-1"><span className="font-medium">{t('locks.revocableLabel')}</span><p className="text-xs text-gray-500">{t('locks.revocableHint')}</p></label></div>
              <p className="text-xs text-gray-500 p-2 bg-gray-800/50 rounded">⚠️ {t('locks.feeWarning')}</p>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleCreateLock} disabled={loading || !selectedToken || !beneficiary || !amount || !unlockDate} className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors">{loading ? t('locks.creating') : t('locks.createTimeLock')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={!bulkProcessing ? () => { setShowBulkModal(false); resetBulkModal(); } : undefined}
          />

          <div className="relative w-full max-w-5xl max-h-[90vh] bg-gray-900 rounded-2xl border border-blue-900/30 shadow-2xl overflow-hidden flex flex-col mx-4">
            {/* Header */}
            <div className="p-6 border-b border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">⏰ {t('locks.bulk.title')}</h2>
                  <p className="text-gray-400 text-sm mt-1">{t('locks.bulk.subtitle', { max: MAX_BATCH_SIZE })}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleExportTemplate}
                    disabled={bulkProcessing}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('locks.bulk.downloadTemplate')}</span>
                  </button>
                  <label className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>{t('locks.bulk.importCsv')}</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportCSV}
                      disabled={bulkProcessing}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => { setShowBulkModal(false); resetBulkModal(); }}
                    disabled={bulkProcessing}
                    className="w-full sm:w-auto flex items-center justify-center px-3 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                <span className="text-gray-400">
                  {t('locks.bulk.statsTotal')}: <span className="text-white font-medium">{bulkEntries.length}</span>
                </span>
                <span className="text-gray-400">
                  {t('locks.bulk.statsPending')}: <span className="text-yellow-400 font-medium">{bulkPendingCount}</span>
                </span>
                <span className="text-gray-400">
                  {t('locks.bulk.statsSuccess')}: <span className="text-green-400 font-medium">{bulkSuccessCount}</span>
                </span>
                {bulkErrorCount > 0 && (
                  <span className="text-gray-400">
                    {t('locks.bulk.statsErrors')}: <span className="text-red-400 font-medium">{bulkErrorCount}</span>
                  </span>
                )}
              </div>

              {/* Batch Limit Warning */}
              {bulkPendingCount >= MAX_BATCH_SIZE && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2 text-yellow-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{t('locks.bulk.maxReachedWarning', { max: MAX_BATCH_SIZE })}</span>
                </div>
              )}
            </div>

            {/* Entries List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {bulkEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-xl border transition-all ${
                    entry.status === 'success'
                      ? 'bg-green-900/20 border-green-500/30'
                      : entry.status === 'error'
                      ? 'bg-red-900/20 border-red-500/30'
                      : entry.status === 'processing'
                      ? 'bg-blue-900/20 border-blue-500/30 animate-pulse'
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 text-gray-300 text-sm font-semibold">
                        {index + 1}
                      </span>
                      {entry.status === 'processing' && (<Loader2 className="w-5 h-5 text-blue-400 animate-spin" />)}
                      {entry.status === 'success' && (<CheckCircle className="w-5 h-5 text-green-400" />)}
                      {entry.status === 'error' && (<AlertCircle className="w-5 h-5 text-red-400" />)}
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">{t('locks.fields.beneficiaryAddress')}</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={entry.beneficiary}
                            onChange={(e) => updateBulkEntry(entry.id, 'beneficiary', e.target.value)}
                            placeholder="GXXXX..."
                            disabled={entry.status !== 'pending' || bulkProcessing}
                            className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 font-mono text-sm"
                            list={`contacts-${entry.id}`}
                          />
                          <datalist id={`contacts-${entry.id}`}>
                            {contacts.map(c => (<option key={c.address} value={c.address}>{c.name}</option>))}
                          </datalist>
                          {getContactName(entry.beneficiary) && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-purple-400">
                              {getContactName(entry.beneficiary)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('locks.fields.amount')}</label>
                        <input
                          type="number"
                          value={entry.amount}
                          onChange={(e) => updateBulkEntry(entry.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          step="any"
                          min="0"
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('locks.fields.token')}</label>
                        <select
                          value={entry.token}
                          onChange={(e) => updateBulkEntry(entry.id, 'token', e.target.value)}
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                        >
                          {vaultBalance.map(token => (
                            <option key={token.address} value={token.address}>
                              {token.symbol} ({formatAmount(token.balance, token.decimals)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('locks.fields.unlockDate')}</label>
                        <input
                          type="datetime-local"
                          value={entry.unlockDate}
                          onChange={(e) => updateBulkEntry(entry.id, 'unlockDate', e.target.value)}
                          min={new Date().toISOString().slice(0,16)}
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('locks.fields.description')}</label>
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) => updateBulkEntry(entry.id, 'description', e.target.value)}
                          placeholder={t('locks.optional')}
                          maxLength={32}
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`revocable-${entry.id}`}
                          checked={entry.revocable}
                          onChange={(e) => updateBulkEntry(entry.id, 'revocable', e.target.checked)}
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-4 h-4 rounded border-gray-700 bg-gray-900/50 text-purple-500 focus:ring-purple-500/50"
                        />
                        <label htmlFor={`revocable-${entry.id}`} className="text-sm text-gray-400">
                          {t('locks.revocableLabel')}
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => duplicateBulkEntry(entry)}
                        disabled={entry.status !== 'pending' || bulkProcessing}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-blue-400 disabled:opacity-50"
                        title={t('locks.bulk.duplicate')}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeBulkEntry(entry.id)}
                        disabled={bulkEntries.length <= 1 || entry.status !== 'pending' || bulkProcessing}
                        className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400 disabled:opacity-50"
                        title={t('locks.bulk.remove')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {entry.error && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>{entry.error}</span>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={addBulkEntry}
                disabled={bulkProcessing}
                className="w-full p-4 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:border-purple-500/50 hover:text-purple-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
                <span>{t('locks.bulk.addEntry')}</span>
              </button>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-800 bg-gray-900/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {bulkProcessing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      {t('locks.bulk.processing', { current: bulkCurrentIndex + 1, total: bulkEntries.length })}
                    </span>
                  ) : (
                    <span>
                      {t('locks.bulk.readyCount', { count: bulkPendingCount })}
                      {bulkPendingCount > 0 && <span className="text-yellow-400 ml-2">{t('locks.bulk.feeTotal', { fee: bulkPendingCount * 10 })}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowBulkModal(false); resetBulkModal(); }}
                    disabled={bulkProcessing}
                    className="px-6 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {bulkSuccessCount === bulkEntries.length && bulkEntries.length > 0 ? t('locks.close') : t('locks.cancel')}
                  </button>
                  <button
                    onClick={handleBulkProcessAll}
                    disabled={bulkProcessing || bulkPendingCount === 0}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {bulkProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('locks.bulk.creatingProposals')}</span>
                      </>
                    ) : (
                      <span>{t('locks.bulk.createCount', { count: bulkPendingCount })}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locks;
