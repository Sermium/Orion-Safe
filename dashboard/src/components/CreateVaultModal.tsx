import React, { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { rpc, TransactionBuilder, scValToNative, Horizon } from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { buildCreateVaultTx, getFactoryConfig, getVaultsByOwner } from '../services/factoryService';
import { getRpcUrl, getFactoryId, NETWORK_PASSPHRASE, getHorizonUrl } from '../config';
import { getContacts, Contact } from '../services/contactsService';
import { insertVault, insertVaultSigners } from '../lib/supabase';
import { AlertCircle, ExternalLink, Loader2, X, Users, Shield } from 'lucide-react';

interface CreateVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  onVaultCreated: (vaultAddress: string) => void;
}

const CreateVaultModal: React.FC<CreateVaultModalProps> = ({
  isOpen,
  onClose,
  userAddress,
  onVaultCreated,
}) => {
  const { t } = useTranslation();
  const [vaultName, setVaultName] = useState('');
  const [defaultName, setDefaultName] = useState('');
  const [signers, setSigners] = useState<string[]>([userAddress]);
  const [newSigner, setNewSigner] = useState('');
  const [threshold, setThreshold] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fee, setFee] = useState<number>(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactPicker, setShowContactPicker] = useState(false);

  // Balance check state
  const [userBalance, setUserBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceChecked, setBalanceChecked] = useState(false);

  // Calculate required balance (fee + reserve for transaction costs)
  const feeInXlm = fee / 10000000;
  const MIN_RESERVE = 2; // Extra XLM for transaction fees and minimum balance
  const requiredBalance = feeInXlm + MIN_RESERVE;
  const hasEnoughBalance = userBalance >= requiredBalance;

  // Check user's XLM balance
  const checkBalance = async () => {
    if (!userAddress) return;

    setBalanceLoading(true);
    try {
      const server = new Horizon.Server(getHorizonUrl());
      const account = await server.loadAccount(userAddress);
      const xlmBalance = account.balances.find(
        (b: any) => b.asset_type === 'native'
      );
      const balance = xlmBalance ? parseFloat(xlmBalance.balance) : 0;
      setUserBalance(balance);
      setBalanceChecked(true);
    } catch (err) {
      console.error('Failed to check balance:', err);
      // If account doesn't exist or error, assume 0 balance
      setUserBalance(0);
      setBalanceChecked(true);
    } finally {
      setBalanceLoading(false);
    }
  };

  // Set default vault name based on existing vaults
  useEffect(() => {
    const loadDefaultName = async () => {
      if (!userAddress) return;
      try {
        const existingVaults = await getVaultsByOwner(userAddress);
        const vaultNumber = existingVaults.length + 1;
        setDefaultName(t('createVault.defaultNameNumbered', { number: vaultNumber }));
      } catch {
        setDefaultName(t('createVault.defaultName'));
      }
    };
    if (isOpen) {
      loadDefaultName();
    }
  }, [userAddress, isOpen, t]);

  // Load contacts when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadedContacts = getContacts();
      setContacts(loadedContacts);
    }
  }, [isOpen]);

  // Initialize signers with user address
  useEffect(() => {
    if (isOpen && userAddress) {
      setSigners([userAddress]);
    }
  }, [isOpen, userAddress]);

  // Load factory fee and check balance when modal opens
  useEffect(() => {
    const loadFeeAndBalance = async () => {
      try {
        const config = await getFactoryConfig();
        if (config) {
          setFee(Number(config.fee_amount) || 0);
        }
      } catch {
        setFee(0);
      }

      // Check balance after loading fee
      await checkBalance();
    };

    if (isOpen && userAddress) {
      setBalanceChecked(false);
      loadFeeAndBalance();
    }
  }, [isOpen, userAddress]);

  const handleAddSigner = () => {
    const trimmed = newSigner.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('G') || trimmed.length !== 56) {
      setError(t('createVault.errors.invalidAddress'));
      return;
    }
    if (signers.includes(trimmed)) {
      setError(t('createVault.errors.signerExists'));
      return;
    }
    setSigners([...signers, trimmed]);
    setNewSigner('');
    setError(null);
  };

  const handleAddContactAsSigner = (contact: Contact) => {
    if (signers.includes(contact.address)) {
      setError(t('createVault.errors.signerExists'));
      return;
    }
    setSigners([...signers, contact.address]);
    setShowContactPicker(false);
    setError(null);
  };

  const handleRemoveSigner = (address: string) => {
    if (address === userAddress) return;
    const newSigners = signers.filter((s) => s !== address);
    setSigners(newSigners);
    if (threshold > newSigners.length) {
      setThreshold(newSigners.length);
    }
  };

  const handleCreateVault = async () => {
    // Double-check balance before proceeding
    if (!hasEnoughBalance) {
      setError(t('createVault.errors.insufficientBalance', { amount: requiredBalance.toFixed(1) }));
      return;
    }

    if (signers.length < threshold) {
      setError(t('createVault.errors.signersBelowThreshold'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const factoryId = getFactoryId();
      if (!factoryId) throw new Error(t('createVault.errors.factoryNotConfigured'));

      // Clean vault name
      let cleanName = (vaultName.trim() || defaultName)
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .substring(0, 32);

      // Build transaction
      const builtTx = await buildCreateVaultTx(
        userAddress,
        cleanName,
        signers,
        threshold
      );

      // Convert to XDR for signing
      const txXdr = builtTx.toXDR();

      // Sign with Freighter
      const signResult = await signTransaction(txXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedXdr = typeof signResult === 'string' ? signResult : signResult.signedTxXdr;

      // Submit transaction
      const server = new rpc.Server(getRpcUrl());
      const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const sendResult = await server.sendTransaction(tx);

      // Poll for result
      let getResult: rpc.Api.GetTransactionResponse;
      let attempts = 0;
      const maxAttempts = 30;

      do {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        getResult = await server.getTransaction(sendResult.hash);
        attempts++;
      } while (getResult.status === 'NOT_FOUND' && attempts < maxAttempts);

      if (getResult.status !== 'SUCCESS') {
        throw new Error(t('createVault.errors.transactionFailed'));
      }

      // Extract vault address from result
      const resultXdr = (getResult as rpc.Api.GetSuccessfulTransactionResponse).returnValue;
      if (!resultXdr) {
        throw new Error(t('createVault.errors.noReturnValue'));
      }
      const vaultAddressRaw = scValToNative(resultXdr);
      console.log('vaultAddressRaw:', vaultAddressRaw, 'type:', typeof vaultAddressRaw);

      let vaultAddress: string;

      if (typeof vaultAddressRaw === 'string') {
        vaultAddress = vaultAddressRaw;
      } else if (vaultAddressRaw && typeof vaultAddressRaw === 'object') {
        // Handle Address object from Stellar SDK
        if (vaultAddressRaw.constructor?.name === 'Address' || vaultAddressRaw._type === 'address') {
          // Try to get the string representation
          vaultAddress = vaultAddressRaw.toString();
        } else if (Buffer.isBuffer(vaultAddressRaw) || vaultAddressRaw instanceof Uint8Array) {
          // If it's a buffer, encode it
          const { StrKey } = require('@stellar/stellar-sdk');
          vaultAddress = StrKey.encodeContract(vaultAddressRaw);
        } else {
          // Try JSON stringify to see what we have
          console.error('Unknown vault address format:', JSON.stringify(vaultAddressRaw), vaultAddressRaw);
          throw new Error(t('createVault.errors.parseFailed'));
        }
      } else {
        throw new Error(t('createVault.errors.noAddress'));
      }

      // Validate the address looks correct (starts with C for contract or G for account)
      if (!vaultAddress || (!vaultAddress.startsWith('C') && !vaultAddress.startsWith('G'))) {
        console.error('Invalid vault address format:', vaultAddress);
        throw new Error(t('createVault.errors.invalidVaultAddress'));
      }

      console.log('Parsed vault address:', vaultAddress);

      // Save to database
      await insertVault({
        address: vaultAddress,
        factory_address: factoryId,
        name: cleanName,
        creator_address: userAddress,
        threshold: threshold,
        signer_count: signers.length,
        is_active: true,
      });

      await insertVaultSigners(
        signers.map((s, i) => ({
          vault_address: vaultAddress,
          signer_address: s,
          role: i === 0 ? 'SuperAdmin' : 'Executor',
          is_active: true,
        }))
      );

      // Notify parent and close immediately
      onVaultCreated(vaultAddress);
      handleClose();

    } catch (err: any) {
      console.error('Create vault error:', err);
      setError(err.message || t('createVault.errors.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVaultName('');
    setSigners([userAddress]);
    setNewSigner('');
    setThreshold(1);
    setError(null);
    setLoading(false);
    setShowContactPicker(false);
    setBalanceChecked(false);
    setUserBalance(0);
    onClose();
  };

  if (!isOpen) return null;

  const availableContacts = contacts.filter((c) => !signers.includes(c.address));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">{t('createVault.title')}</h2>
            <button
              onClick={handleClose}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Insufficient Balance Warning */}
          {balanceChecked && !hasEnoughBalance && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-400 font-semibold">{t('createVault.balance.insufficientTitle')}</p>
                  <p className="text-gray-300 text-sm mt-1">
                    <Trans
                      i18nKey="createVault.balance.needAtLeast"
                      values={{ amount: requiredBalance.toFixed(1) }}
                      components={{ b: <span className="text-white font-semibold" /> }}
                    />
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    <Trans
                      i18nKey="createVault.balance.current"
                      values={{ amount: userBalance.toFixed(4) }}
                      components={{ b: <span className="text-white font-medium" /> }}
                    />
                  </p>
                  <p className="text-gray-500 text-xs mt-2">
                    {t('createVault.balance.coversFee', { fee: feeInXlm.toFixed(0) })}
                  </p>
                  <a
                    href="https://laboratory.stellar.org/#account-creator?network=test"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm mt-3 transition-colors"
                  >
                    <span>{t('createVault.balance.getFriendbot')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Balance Loading */}
          {balanceLoading && (
            <div className="mb-4 p-3 bg-gray-800/50 rounded-lg flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('createVault.balance.checking')}</span>
            </div>
          )}

          {/* Vault Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              {t('createVault.vaultName')}
            </label>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder={defaultName}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              maxLength={32}
              disabled={loading}
            />
          </div>

          {/* Signers */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <Users className="w-4 h-4" />
              <span>{t('createVault.signers', { count: signers.length })}</span>
            </label>

            <div className="space-y-2 mb-3">
              {signers.map((signer, index) => (
                <div
                  key={signer}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white font-mono text-sm truncate">
                      {signer.slice(0, 8)}...{signer.slice(-8)}
                    </span>
                    {index === 0 && (
                      <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded flex-shrink-0">
                        {t('createVault.youOwner')}
                      </span>
                    )}
                  </div>
                  {index !== 0 && (
                    <button
                      onClick={() => handleRemoveSigner(signer)}
                      className="text-gray-400 hover:text-red-400 p-1 flex-shrink-0"
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSigner}
                onChange={(e) => setNewSigner(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSigner()}
                placeholder={t('createVault.addSignerPlaceholder')}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm transition-colors"
                disabled={loading}
              />
              <button
                onClick={handleAddSigner}
                disabled={loading || !newSigner.trim()}
                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:hover:bg-gray-700 rounded-lg text-white text-sm transition-colors"
              >
                {t('createVault.add')}
              </button>
            </div>

            {availableContacts.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowContactPicker(!showContactPicker)}
                  className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                  disabled={loading}
                >
                  {showContactPicker ? t('createVault.hideContacts') : t('createVault.addFromContacts')}
                </button>
                {showContactPicker && (
                  <div className="mt-2 p-2 bg-gray-800 rounded-lg max-h-32 overflow-y-auto">
                    {availableContacts.map((contact) => (
                      <button
                        key={contact.address}
                        onClick={() => handleAddContactAsSigner(contact)}
                        className="w-full text-left p-2 hover:bg-gray-700 rounded text-sm transition-colors"
                        disabled={loading}
                      >
                        <span className="text-white">{contact.name}</span>
                        <span className="text-gray-400 ml-2 font-mono text-xs">
                          {contact.address.slice(0, 8)}...
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Threshold */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              <Shield className="w-4 h-4" />
              <span>{t('createVault.thresholdLabel', { threshold, total: signers.length })}</span>
            </label>
            <input
              type="range"
              min={1}
              max={signers.length}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-cyan-500"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('createVault.thresholdHint', { count: threshold })}
            </p>
          </div>

          {/* Fee Info */}
          {fee > 0 && hasEnoughBalance && (
            <div className="mb-6 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{t('createVault.fee.creationFee')}</span>
                <span className="text-white font-medium">{feeInXlm} XLM</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-400">{t('createVault.fee.yourBalance')}</span>
                <span className="text-green-400 font-medium">{userBalance.toFixed(4)} XLM</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl text-white font-medium transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreateVault}
              disabled={loading || signers.length === 0 || !hasEnoughBalance || balanceLoading}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('createVault.creating')}</span>
                </>
              ) : balanceLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('createVault.checking')}</span>
                </>
              ) : !hasEnoughBalance ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>{t('createVault.insufficientBalanceShort')}</span>
                </>
              ) : (
                t('createVault.createButton')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateVaultModal;
