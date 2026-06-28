import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getContacts, Contact } from '../../services/contactsService';
import { Plus, Trash2, Upload, Download, AlertCircle, CheckCircle, Loader2, X, Copy, RefreshCw } from 'lucide-react';

// Constants for batch limits
const MAX_BATCH_SIZE = 10;
const BATCH_DELAY_MS = 3000;

// CSV Example Template for Vesting — kept in English; the parser relies on English headers.
const CSV_VESTING_EXAMPLE = `# Bulk Vesting Template - Orion Safe
# Maximum ${MAX_BATCH_SIZE} vesting schedules per batch to avoid network overload
#
# Format: beneficiary,amount,token,cliff_days,vesting_days,interval_days,revocable,description
#
# Field explanations:
# - beneficiary: Stellar address starting with G
# - amount: Token amount (will use token decimals)
# - token: Token contract address
# - cliff_days: Days until first release (0 = immediate vesting start)
# - vesting_days: Total vesting duration in days
# - interval_days: Release frequency (1=daily, 7=weekly, 30=monthly, 90=quarterly)
# - revocable: true (admin can cancel) or false (guaranteed vesting)
# - description: Optional note (max 32 chars)
#
# Common vesting schedules:
# - Employee: 365 cliff, 1460 duration (4yr with 1yr cliff), monthly releases
# - Advisor: 90 cliff, 730 duration (2yr with 3mo cliff), monthly releases
# - Contributor: 0 cliff, 180 duration (6mo immediate), weekly releases
#
# Example entries:
beneficiary,amount,token,cliff_days,vesting_days,interval_days,revocable,description
GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON,100000,CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC,365,1460,30,true,Employee - 4yr vest
GCFONE23AB7Y6C5YZOMKPQHBLRPNXACTTBLCBHWBXM5CUUTP7M4JOZQQ,25000,CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC,90,730,30,true,Advisor - 2yr vest
GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOUJ3DCMOPJCXP6V,5000,CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC,0,180,7,false,Contributor reward`;

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

interface BulkVestingEntry {
  id: string;
  beneficiary: string;
  amount: string;
  token: string;
  cliffDays: string;
  vestingDays: string;
  releaseIntervalDays: string;
  revocable: boolean;
  description: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface VestingProps {
  vaultAddress: string | null;
  locks: Lock[];
  vaultBalance: TokenBalance[];
  proposals?: Proposal[];
  userRole?: string;
  publicKey: string | null;
  onCreateVestingLock: (
    beneficiary: string,
    token: string,
    amount: string,
    startTime: number,
    cliffDuration: number,
    totalDuration: number,
    releaseIntervals: number,
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

const Vesting: React.FC<VestingProps> = ({
  vaultAddress,
  locks: allLocks,
  vaultBalance,
  proposals = [],
  userRole,
  publicKey,
  onCreateVestingLock,
  onClaimLock,
  onCancelLock,
  onRefresh,
  preselectedToken,
  isPublicView = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
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
  const [cliffDays, setCliffDays] = useState('30');
  const [vestingDays, setVestingDays] = useState('365');
  const [releaseIntervalDays, setReleaseIntervalDays] = useState('30');
  const [revocable, setRevocable] = useState(true);
  const [description, setDescription] = useState('');

  // Bulk modal state
  const [bulkEntries, setBulkEntries] = useState<BulkVestingEntry[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkCurrentIndex, setBulkCurrentIndex] = useState(0);

  const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';
  const locks = allLocks.filter(l => getLockTypeString(l.lock_type) === 'Vesting');

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
    const now = Math.floor(Date.now() / 1000);
    return now >= Number(lock.cliff_time);
  };

  const canUserClaim = (lock: Lock): boolean => !!(publicKey && isLockClaimable(lock) && lock.beneficiary === publicKey);
  const canUserCancel = (lock: Lock): boolean => !!(publicKey && isAdmin && lock.revocable && ['Active', 'PartiallyReleased'].includes(getStatusString(lock.status)));

  const getProgressPercent = (lock: Lock): number => { const tot = safeBigInt(lock.total_amount); return tot === BigInt(0) ? 0 : Number((safeBigInt(lock.released_amount) * BigInt(100)) / tot); };

  const getVestedAmount = (lock: Lock): bigint => {
    const now = Math.floor(Date.now() / 1000);
    const cliffTime = Number(lock.cliff_time);
    const endTime = Number(lock.end_time);
    const total = safeBigInt(lock.total_amount);
    if (now < cliffTime) return BigInt(0);
    if (now >= endTime) return total;
    const elapsed = BigInt(now - Number(lock.start_time));
    const duration = BigInt(endTime - Number(lock.start_time));
    return (total * elapsed) / duration;
  };

  const getClaimableAmount = (lock: Lock): bigint => {
    const vested = getVestedAmount(lock);
    const released = safeBigInt(lock.released_amount);
    return vested > released ? vested - released : BigInt(0);
  };

  const getTimeRemaining = (lock: Lock): string => {
    const now = Math.floor(Date.now() / 1000);
    const cliffTime = Number(lock.cliff_time);
    const endTime = Number(lock.end_time);
    if (now < cliffTime) {
      const diff = cliffTime - now;
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      return t('vesting.time.toCliff', { days, hours });
    }
    if (now >= endTime) return t('vesting.time.fullyVested');
    const diff = endTime - now;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return t('vesting.time.remaining', { days, hours });
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

  // Translated display label for a status.
  const getStatusLabel = (status: any): string => {
    switch (getStatusString(status)) {
      case 'Active': return t('vesting.status.active');
      case 'PartiallyReleased': return t('vesting.status.partiallyReleased');
      case 'FullyReleased': return t('vesting.status.fullyReleased');
      case 'Cancelled': return t('vesting.status.cancelled');
      default: return t('common.unknown');
    }
  };

  const handleCreateVesting = async () => {
    if (!selectedToken || !beneficiary || !amount) { setError(t('vesting.errors.fillRequired')); return; }
    if (!beneficiary.startsWith('G') || beneficiary.length !== 56) { setError(t('vesting.errors.invalidBeneficiary')); return; }
    setLoading(true); setError(null);
    try {
      const startTime = Math.floor(Date.now() / 1000);
      const cliffDuration = parseInt(cliffDays) * 86400;
      const totalDuration = parseInt(vestingDays) * 86400;
      const releaseIntervals = parseInt(releaseIntervalDays) * 86400;
      if (totalDuration <= 0) { setError(t('vesting.errors.durationPositive')); setLoading(false); return; }
      if (cliffDuration >= totalDuration) { setError(t('vesting.errors.cliffShorter')); setLoading(false); return; }
      await onCreateVestingLock(beneficiary, selectedToken, amount, startTime, cliffDuration, totalDuration, releaseIntervals, revocable, description || t('vesting.defaultDescription'));
      setShowCreateModal(false); resetForm(); onRefresh();
    } catch (err: any) { setError(err.message || t('vesting.errors.createFailed')); } finally { setLoading(false); }
  };

  const handleClaim = async (lockId: number | bigint) => {
    setLoading(true); setError(null);
    try { await onClaimLock(typeof lockId === 'bigint' ? Number(lockId) : lockId); onRefresh(); }
    catch (err: any) { setError(err.message || t('vesting.errors.claimFailed')); } finally { setLoading(false); }
  };

  const handleCancel = async (lockId: number | bigint) => {
    if (!window.confirm(t('vesting.confirmCancel'))) return;
    setLoading(true); setError(null);
    try { await onCancelLock(typeof lockId === 'bigint' ? Number(lockId) : lockId); onRefresh(); }
    catch (err: any) { setError(err.message || t('vesting.errors.cancelFailed')); } finally { setLoading(false); }
  };

  const resetForm = () => { setBeneficiary(''); setContactSearch(''); setSelectedToken(''); setAmount(''); setCliffDays('30'); setVestingDays('365'); setReleaseIntervalDays('30'); setRevocable(true); setDescription(''); setShowContactDropdown(false); };

  // ==================== BULK MODAL FUNCTIONS ====================
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addBulkEntry = () => {
    if (bulkEntries.filter(e => e.status === 'pending').length >= MAX_BATCH_SIZE) {
      alert(t('vesting.bulk.maxBatchAlert', { max: MAX_BATCH_SIZE }));
      return;
    }
    const newEntry: BulkVestingEntry = {
      id: generateId(),
      beneficiary: '',
      amount: '',
      token: vaultBalance[0]?.address || '',
      cliffDays: '30',
      vestingDays: '365',
      releaseIntervalDays: '30',
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

  const updateBulkEntry = (id: string, field: keyof BulkVestingEntry, value: any) => {
    setBulkEntries(prev => prev.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const duplicateBulkEntry = (entry: BulkVestingEntry) => {
    const newEntry: BulkVestingEntry = {
      ...entry,
      id: generateId(),
      beneficiary: '',
      status: 'pending',
      error: undefined,
    };
    setBulkEntries(prev => [...prev, newEntry]);
  };

  const applyToAll = (field: keyof BulkVestingEntry, value: any) => {
    setBulkEntries(prev => prev.map(e =>
      e.status === 'pending' ? { ...e, [field]: value } : e
    ));
  };

  const validateBulkEntry = (entry: BulkVestingEntry): string | null => {
    if (!entry.beneficiary || entry.beneficiary.length !== 56 || !entry.beneficiary.startsWith('G')) {
      return t('vesting.bulk.errors.invalidBeneficiary');
    }
    if (!entry.amount || parseFloat(entry.amount) <= 0) {
      return t('vesting.bulk.errors.invalidAmount');
    }
    if (!entry.token) {
      return t('vesting.bulk.errors.noToken');
    }
    const cliffDaysNum = parseInt(entry.cliffDays);
    const vestingDaysNum = parseInt(entry.vestingDays);
    const intervalDaysNum = parseInt(entry.releaseIntervalDays);

    if (isNaN(vestingDaysNum) || vestingDaysNum <= 0) {
      return t('vesting.bulk.errors.durationPositive');
    }
    if (isNaN(cliffDaysNum) || cliffDaysNum < 0) {
      return t('vesting.bulk.errors.invalidCliff');
    }
    if (cliffDaysNum >= vestingDaysNum) {
      return t('vesting.bulk.errors.cliffShorter');
    }
    if (isNaN(intervalDaysNum) || intervalDaysNum <= 0) {
      return t('vesting.bulk.errors.invalidInterval');
    }
    return null;
  };

  const handleBulkProcessAll = async () => {
    // Validate all entries first
    const validationErrors: { [key: string]: string } = {};
    bulkEntries.forEach(entry => {
      const error = validateBulkEntry(entry);
      if (error) {
        validationErrors[entry.id] = error;
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

      // Update status to processing
      setBulkEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, status: 'processing' } : e
      ));

      try {
        const startTime = Math.floor(Date.now() / 1000);
        const cliffDuration = parseInt(entry.cliffDays) * 86400;
        const totalDuration = parseInt(entry.vestingDays) * 86400;
        const releaseIntervals = parseInt(entry.releaseIntervalDays) * 86400;

        await onCreateVestingLock(
          entry.beneficiary,
          entry.token,
          entry.amount,
          startTime,
          cliffDuration,
          totalDuration,
          releaseIntervals,
          entry.revocable,
          entry.description || t('vesting.bulk.defaultDescription')
        );

        setBulkEntries(prev => prev.map(e =>
          e.id === entry.id ? { ...e, status: 'success' } : e
        ));

        // Small delay between transactions
        if (i < bulkEntries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      } catch (error: any) {
        setBulkEntries(prev => prev.map(e =>
          e.id === entry.id ? { ...e, status: 'error', error: error.message || t('vesting.bulk.errors.createFailed') } : e
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
        .filter(line => line && !line.startsWith('#')); // Skip empty lines and comments

      // Skip header row if it looks like a header
      const dataLines = lines[0]?.toLowerCase().includes('beneficiary') ? lines.slice(1) : lines;

      if (dataLines.length > MAX_BATCH_SIZE) {
        alert(t('vesting.bulk.csvTooManyAlert', { count: dataLines.length, max: MAX_BATCH_SIZE }));
      }

      const newEntries: BulkVestingEntry[] = dataLines.slice(0, MAX_BATCH_SIZE).map(line => {
        const columns = line.split(',').map(col => col.trim());
        return {
          id: generateId(),
          beneficiary: columns[0] || '',
          amount: columns[1] || '',
          token: columns[2] || vaultBalance[0]?.address || '',
          cliffDays: columns[3] || '30',
          vestingDays: columns[4] || '365',
          releaseIntervalDays: columns[5] || '30',
          revocable: columns[6]?.toLowerCase() !== 'false',
          description: columns[7] || '',
          status: 'pending' as const,
        };
      });

      setBulkEntries(newEntries);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportTemplate = () => {
    const blob = new Blob([CSV_VESTING_EXAMPLE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_vesting_template.csv';
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

  const VestingCard: React.FC<{ lock: Lock; showClaimButton?: boolean; isArchived?: boolean }> = ({ lock, showClaimButton = false, isArchived = false }) => {
    const beneficiaryName = getContactName(lock.beneficiary);
    const creatorName = getContactName(lock.creator);
    const claimable = isLockClaimable(lock);
    const total = safeBigInt(lock.total_amount);
    const released = safeBigInt(lock.released_amount);
    const remaining = total - released;
    const claimableAmount = getClaimableAmount(lock);
    const vestedAmount = getVestedAmount(lock);

    return (
      <div className={'bg-gray-800 rounded-lg p-4 ' + (isArchived ? 'opacity-60 ' : '') + (showClaimButton && claimable && claimableAmount > BigInt(0) ? 'border-2 border-cyan-500/50' : '')}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-lg font-semibold text-white">{t('vesting.cardTitle', { id: getLockId(lock) })}</span>
              <span className={'px-2 py-1 rounded text-xs ' + getStatusColor(lock.status)}>{getStatusLabel(lock.status)}</span>
              <span className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400">📈 {t('vesting.badge')}</span>
              {lock.revocable && !isArchived && <span className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-400">{t('vesting.revocable')}</span>}
              {showClaimButton && claimable && claimableAmount > BigInt(0) && <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 animate-pulse">✓ {t('vesting.claimableBadge', { amount: formatAmount(claimableAmount, getTokenDecimals(lock.token)) })}</span>}
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{t('vesting.vestedLabel', { vested: formatAmount(vestedAmount, getTokenDecimals(lock.token)), total: formatAmount(total, getTokenDecimals(lock.token)) })}</span>
                <span>{Math.min(100, Math.floor(Number(vestedAmount * BigInt(100) / total)))}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className={'h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all'} style={{ width: Math.min(100, Number(vestedAmount * BigInt(100) / total)) + '%' }} />
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{t('vesting.releasedLabel', { released: formatAmount(released, getTokenDecimals(lock.token)) })}</span>
                <span>{getProgressPercent(lock)}%</span>
              </div>
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div className={'h-full bg-green-500 transition-all'} style={{ width: getProgressPercent(lock) + '%' }} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-400">{t('vesting.fields.token')}</p><p className="text-white font-medium">{getTokenSymbol(lock.token)}</p></div>
              <div><p className="text-gray-400">{t('vesting.fields.remaining')}</p><p className={'font-medium ' + (remaining > BigInt(0) ? 'text-yellow-400' : 'text-gray-500')}>{formatAmount(remaining, getTokenDecimals(lock.token))}</p></div>
              <div><p className="text-gray-400">{t('vesting.fields.status')}</p><p className={'font-medium ' + (claimable ? 'text-cyan-400' : 'text-white')}>{getTimeRemaining(lock)}</p></div>
              <div><p className="text-gray-400">{t('vesting.fields.cliffDate')}</p><p className="text-white">{new Date(Number(lock.cliff_time) * 1000).toLocaleDateString(locale)}</p></div>
              <div><p className="text-gray-400">{t('vesting.fields.endDate')}</p><p className="text-white">{new Date(Number(lock.end_time) * 1000).toLocaleDateString(locale)}</p></div>
              <div><p className="text-gray-400">{t('vesting.fields.releaseInterval')}</p><p className="text-white">{t('vesting.daysValue', { count: Math.floor(Number(lock.release_intervals) / 86400) })}</p></div>
              <div><p className="text-gray-400">{t('vesting.fields.beneficiary')}</p>
                <div className="flex items-center gap-2">
                  {beneficiaryName ? <><span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{beneficiaryName}</span><span className="text-gray-500 text-xs">{truncateAddress(lock.beneficiary)}</span></> : <span className="text-white font-mono text-xs">{truncateAddress(lock.beneficiary)}</span>}
                  {lock.beneficiary === publicKey && <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">{t('vesting.you')}</span>}
                </div>
              </div>
              <div><p className="text-gray-400">{t('vesting.fields.creator')}</p>
                <div className="flex items-center gap-2">{creatorName ? <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">{creatorName}</span> : <span className="text-white font-mono text-xs">{truncateAddress(lock.creator)}</span>}</div>
              </div>
              {lock.description && <div className="col-span-2"><p className="text-gray-400">{t('vesting.fields.description')}</p><p className="text-white">{lock.description}</p></div>}
            </div>
          </div>
          {!isPublicView && !isArchived && (
            <div className="flex flex-col gap-2 ml-4">
              {canUserClaim(lock) && claimableAmount > BigInt(0) && <button onClick={() => handleClaim(lock.id)} disabled={loading} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-white font-semibold disabled:opacity-50 transition-all shadow-lg shadow-cyan-500/25">{loading ? '...' : t('vesting.claimButton')}</button>}
              {canUserCancel(lock) && <button onClick={() => handleCancel(lock.id)} disabled={loading} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm disabled:opacity-50 transition-colors">{t('common.cancel')}</button>}
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
          <h1 className="text-xl sm:text-2xl font-bold text-white">📈 {t('vesting.title')}</h1>
          <p className="text-gray-400 text-sm sm:text-base mt-1">{t('vesting.subtitle')}</p>
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
                className="w-full sm:w-auto px-4 py-2.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg text-cyan-400 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {t('vesting.bulkCreate')}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors"
              >
                + {t('vesting.createVesting')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400">{error}<button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">✕</button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4"><p className="text-gray-400 text-sm">{t('vesting.stats.totalVesting')}</p><p className="text-2xl font-bold text-white">{locks.length}</p></div>
        <div className="bg-gray-800 rounded-lg p-4"><p className="text-gray-400 text-sm">{t('vesting.stats.active')}</p><p className="text-2xl font-bold text-green-400">{activeLocks.length + myClaimableLocks.filter(l => getStatusString(l.status) === 'Active').length}</p></div>
        <div className="bg-gray-800 rounded-lg p-4"><p className="text-gray-400 text-sm">{t('vesting.stats.claimable')}</p><p className="text-2xl font-bold text-cyan-400">{locks.filter(l => isLockClaimable(l) && getClaimableAmount(l) > BigInt(0)).length}</p></div>
        <div className="bg-gray-800 rounded-lg p-4"><p className="text-gray-400 text-sm">{t('vesting.stats.yourVesting')}</p><p className="text-2xl font-bold text-purple-400">{locks.filter(l => l.beneficiary === publicKey).length}</p></div>
      </div>

      {myClaimableLocks.length > 0 && !isPublicView && <div className="mb-8"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="text-2xl">🎁</span>{t('vesting.sections.yours')}</h2><div className="space-y-4">{myClaimableLocks.map(lock => <VestingCard key={getLockId(lock)} lock={lock} showClaimButton={true} />)}</div></div>}
      {activeLocks.length > 0 && <div className="mb-8"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="text-2xl">📊</span>{t('vesting.sections.active')}</h2><div className="space-y-4">{activeLocks.map(lock => <VestingCard key={getLockId(lock)} lock={lock} />)}</div></div>}
      {pendingCompletion.length > 0 && <div className="mb-8"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="text-2xl">⏳</span>{t('vesting.sections.pendingCompletion')}</h2><div className="space-y-4">{pendingCompletion.map(lock => <VestingCard key={getLockId(lock)} lock={lock} />)}</div></div>}

      {locks.length === 0 && <div className="bg-gray-800 rounded-lg p-8 text-center"><div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center"><span className="text-3xl">📈</span></div><p className="text-gray-400 mb-4">{t('vesting.empty')}</p>{isAdmin && !isPublicView && <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white">{t('vesting.createFirst')}</button>}</div>}

      {archivedLocks.length > 0 && <div className="mt-8"><button onClick={() => setShowArchived(!showArchived)} className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"><div className="flex items-center gap-2"><span className="text-xl">📦</span><span className="text-lg font-semibold text-gray-300">{t('vesting.archived')}</span><span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-sm">{archivedLocks.length}</span></div><svg className={'w-5 h-5 text-gray-400 transition-transform ' + (showArchived ? 'rotate-180' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>{showArchived && <div className="mt-4 space-y-4">{archivedLocks.map(lock => <VestingCard key={getLockId(lock)} lock={lock} isArchived={true} />)}</div>}</div>}

      {/* Single Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white">📈 {t('vesting.modal.title')}</h2><button onClick={() => { setShowCreateModal(false); resetForm(); }} className="text-gray-400 hover:text-white">✕</button></div>
            <div className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1">{t('vesting.modal.token')}</label><select value={selectedToken} onChange={e => setSelectedToken(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"><option value="">{t('vesting.modal.selectToken')}</option>{vaultBalance.map(token => <option key={token.address} value={token.address}>{t('vesting.modal.tokenOption', { symbol: token.symbol, amount: formatAmount(getAvailableBalance(token.address || ''), token.decimals) })}</option>)}</select></div>
              <div><label className="block text-sm text-gray-400 mb-1">{t('vesting.modal.totalAmount')}</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="any" min="0" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none" /></div>
              <div className="relative">
                <label className="block text-sm text-gray-400 mb-1">{t('vesting.modal.beneficiary')}</label>
                {contacts.length > 0 && <div className="flex gap-2 mb-2 flex-wrap"><span className="text-xs text-gray-500">{t('vesting.modal.quickSelect')}</span>{contacts.slice(0,5).map(c => <button key={c.id} type="button" onClick={() => handleSelectContact(c)} className={'px-2 py-1 text-xs rounded-full transition-colors ' + (beneficiary === c.address ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600')}>{c.name}</button>)}</div>}
                <input type="text" value={beneficiary.startsWith('G') ? beneficiary : contactSearch} onChange={e => handleBeneficiaryChange(e.target.value)} onFocus={() => { if (contacts.length > 0 && !beneficiary.startsWith('G')) setShowContactDropdown(true); }} placeholder={t('vesting.modal.beneficiaryPlaceholder')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none" />
                {showContactDropdown && filteredContacts.length > 0 && <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">{filteredContacts.map(c => <button key={c.id} type="button" onClick={() => handleSelectContact(c)} className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-sm">{c.name.charAt(0).toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-white font-medium truncate">{c.name}</p><p className="text-gray-400 text-xs font-mono truncate">{c.address}</p></div></button>)}</div>}
                {beneficiary.startsWith('G') && <p className="text-xs text-gray-500 mt-1 font-mono truncate">{beneficiary}</p>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">{t('vesting.modal.cliffDays')}</label><input type="number" value={cliffDays} onChange={e => setCliffDays(e.target.value)} placeholder="30" min="0" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none" /><p className="text-xs text-gray-500 mt-1">{t('vesting.modal.cliffHint')}</p></div>
                <div><label className="block text-sm text-gray-400 mb-1">{t('vesting.modal.durationDays')}</label><input type="number" value={vestingDays} onChange={e => setVestingDays(e.target.value)} placeholder="365" min="1" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none" /><p className="text-xs text-gray-500 mt-1">{t('vesting.modal.durationHint')}</p></div>
                <div><label className="block text-sm text-gray-400 mb-1">{t('vesting.modal.intervalDays')}</label><input type="number" value={releaseIntervalDays} onChange={e => setReleaseIntervalDays(e.target.value)} placeholder="30" min="1" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none" /><p className="text-xs text-gray-500 mt-1">{t('vesting.modal.intervalHint')}</p></div>
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">{t('vesting.modal.descriptionLabel')}</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('vesting.modal.descriptionPlaceholder')} maxLength={32} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none" /></div>
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg"><input type="checkbox" id="revocable" checked={revocable} onChange={e => setRevocable(e.target.checked)} className="w-4 h-4 rounded" /><label htmlFor="revocable" className="text-gray-300 flex-1"><span className="font-medium">{t('vesting.revocable')}</span><p className="text-xs text-gray-500">{t('vesting.modal.revocableHint')}</p></label></div>
              <div className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg text-sm">
                <p className="text-cyan-400 font-medium mb-2">{t('vesting.modal.previewTitle')}</p>
                <div className="text-gray-300 space-y-1">
                  <p>{t('vesting.modal.previewCliff', { date: new Date(Date.now() + parseInt(cliffDays || '0') * 86400000).toLocaleDateString(locale) })}</p>
                  <p>{t('vesting.modal.previewVested', { date: new Date(Date.now() + parseInt(vestingDays || '0') * 86400000).toLocaleDateString(locale) })}</p>
                  <p>{t('vesting.modal.previewReleases', { days: releaseIntervalDays || '0' })}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 p-2 bg-gray-800/50 rounded">{t('vesting.modal.feeNotice')}</p>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleCreateVesting} disabled={loading || !selectedToken || !beneficiary || !amount} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors">{loading ? t('vesting.modal.creating') : t('vesting.modal.createButton')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={!bulkProcessing ? () => { setShowBulkModal(false); resetBulkModal(); } : undefined}
          />

          {/* Modal */}
          <div className="relative w-full max-w-6xl max-h-[90vh] bg-gray-900 rounded-2xl border border-cyan-900/30 shadow-2xl overflow-hidden flex flex-col mx-4">
            {/* Header */}
            <div className="p-6 border-b border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">📈 {t('vesting.bulk.title')}</h2>
                  <p className="text-gray-400 text-sm mt-1">{t('vesting.bulk.subtitle', { max: MAX_BATCH_SIZE })}</p>
                </div>

                {/* CSV Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleExportTemplate}
                    disabled={bulkProcessing}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('vesting.bulk.downloadTemplate')}</span>
                  </button>
                  <label className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-400 rounded-lg transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>{t('vesting.bulk.importCsv')}</span>
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
                  {t('vesting.bulk.totalLabel')} <span className="text-white font-medium">{bulkEntries.length}</span>
                </span>
                <span className="text-gray-400">
                  {t('vesting.bulk.pendingLabel')} <span className="text-yellow-400 font-medium">{bulkPendingCount}</span>
                </span>
                <span className="text-gray-400">
                  {t('vesting.bulk.successLabel')} <span className="text-green-400 font-medium">{bulkSuccessCount}</span>
                </span>
                {bulkErrorCount > 0 && (
                  <span className="text-gray-400">
                    {t('vesting.bulk.errorsLabel')} <span className="text-red-400 font-medium">{bulkErrorCount}</span>
                  </span>
                )}
              </div>

              {/* Batch Limit Warning */}
              {bulkPendingCount >= MAX_BATCH_SIZE && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2 text-yellow-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{t('vesting.bulk.maxBatchWarning', { max: MAX_BATCH_SIZE })}</span>
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
                      ? 'bg-cyan-900/20 border-cyan-500/30 animate-pulse'
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Index & Status */}
                    <div className="flex flex-col items-center gap-2">
                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 text-gray-300 text-sm font-semibold">
                        {index + 1}
                      </span>
                      {entry.status === 'processing' && (
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      )}
                      {entry.status === 'success' && (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                      {entry.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>

                    {/* Form Fields */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Beneficiary */}
                      <div className="lg:col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">{t('vesting.bulk.beneficiaryLabel')}</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={entry.beneficiary}
                            onChange={(e) => updateBulkEntry(entry.id, 'beneficiary', e.target.value)}
                            placeholder="GXXXX..."
                            disabled={entry.status !== 'pending' || bulkProcessing}
                            className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-mono text-sm"
                            list={`contacts-${entry.id}`}
                          />
                          <datalist id={`contacts-${entry.id}`}>
                            {contacts.map(c => (
                              <option key={c.address} value={c.address}>{c.name}</option>
                            ))}
                          </datalist>
                          {getContactName(entry.beneficiary) && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-400">
                              {getContactName(entry.beneficiary)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('vesting.bulk.amountLabel')}</label>
                        <input
                          type="number"
                          value={entry.amount}
                          onChange={(e) => updateBulkEntry(entry.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          step="any"
                          min="0"
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                        />
                      </div>

                      {/* Token */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('vesting.bulk.tokenLabel')}</label>
                        <select
                          value={entry.token}
                          onChange={(e) => updateBulkEntry(entry.id, 'token', e.target.value)}
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                        >
                          {vaultBalance.map(token => (
                            <option key={token.address} value={token.address}>
                              {token.symbol}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Cliff Days */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('vesting.bulk.cliffLabel')}</label>
                        <input
                          type="number"
                          value={entry.cliffDays}
                          onChange={(e) => updateBulkEntry(entry.id, 'cliffDays', e.target.value)}
                          placeholder="30"
                          min="0"
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                        />
                      </div>

                      {/* Vesting Days */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('vesting.bulk.durationLabel')}</label>
                        <input
                          type="number"
                          value={entry.vestingDays}
                          onChange={(e) => updateBulkEntry(entry.id, 'vestingDays', e.target.value)}
                          placeholder="365"
                          min="1"
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                        />
                      </div>

                      {/* Release Interval */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('vesting.bulk.intervalLabel')}</label>
                        <select
                          value={entry.releaseIntervalDays}
                          onChange={(e) => updateBulkEntry(entry.id, 'releaseIntervalDays', e.target.value)}
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                        >
                          <option value="1">{t('vesting.interval.daily')}</option>
                          <option value="7">{t('vesting.interval.weekly')}</option>
                          <option value="30">{t('vesting.interval.monthly')}</option>
                          <option value="90">{t('vesting.interval.quarterly')}</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{t('vesting.bulk.descriptionLabel')}</label>
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) => updateBulkEntry(entry.id, 'description', e.target.value)}
                          placeholder={t('vesting.bulk.optionalPlaceholder')}
                          maxLength={32}
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                        />
                      </div>

                      {/* Revocable */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`revocable-${entry.id}`}
                          checked={entry.revocable}
                          onChange={(e) => updateBulkEntry(entry.id, 'revocable', e.target.checked)}
                          disabled={entry.status !== 'pending' || bulkProcessing}
                          className="w-4 h-4 rounded border-gray-700 bg-gray-900/50 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <label htmlFor={`revocable-${entry.id}`} className="text-sm text-gray-400">
                          {t('vesting.revocable')}
                        </label>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => duplicateBulkEntry(entry)}
                        disabled={entry.status !== 'pending' || bulkProcessing}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-cyan-400 disabled:opacity-50"
                        title={t('vesting.bulk.duplicate')}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeBulkEntry(entry.id)}
                        disabled={bulkEntries.length <= 1 || entry.status !== 'pending' || bulkProcessing}
                        className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400 disabled:opacity-50"
                        title={t('vesting.bulk.remove')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {entry.error && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>{entry.error}</span>
                    </div>
                  )}

                  {/* Preview */}
                  {entry.status === 'pending' && entry.beneficiary && entry.amount && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                      <span>{t('vesting.bulk.previewCliff', { date: new Date(Date.now() + parseInt(entry.cliffDays || '0') * 86400000).toLocaleDateString(locale) })}</span>
                      <span>•</span>
                      <span>{t('vesting.bulk.previewEnd', { date: new Date(Date.now() + parseInt(entry.vestingDays || '0') * 86400000).toLocaleDateString(locale) })}</span>
                      <span>•</span>
                      <span>{t('vesting.bulk.previewReleases', { days: entry.releaseIntervalDays })}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Add Entry Button */}
              <button
                onClick={addBulkEntry}
                disabled={bulkProcessing}
                className="w-full p-4 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
                <span>{t('vesting.bulk.addSchedule')}</span>
              </button>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-800 bg-gray-900/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {bulkProcessing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      {t('vesting.bulk.processing', { current: bulkCurrentIndex + 1, total: bulkEntries.length })}
                    </span>
                  ) : (
                    <span>
                      {t('vesting.bulk.readyCount', { count: bulkPendingCount })}
                      {bulkPendingCount > 0 && <span className="text-yellow-400 ml-2">{t('vesting.bulk.feeTotal', { fee: (bulkPendingCount * 0.1).toFixed(1) })}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowBulkModal(false); resetBulkModal(); }}
                    disabled={bulkProcessing}
                    className="px-6 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {bulkSuccessCount === bulkEntries.length && bulkEntries.length > 0 ? t('common.close') : t('common.cancel')}
                  </button>
                  <button
                    onClick={handleBulkProcessAll}
                    disabled={bulkProcessing || bulkPendingCount === 0}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {bulkProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('vesting.bulk.creatingProposals')}</span>
                      </>
                    ) : (
                      <span>{t('vesting.bulk.createProposals', { count: bulkPendingCount })}</span>
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

export default Vesting;
