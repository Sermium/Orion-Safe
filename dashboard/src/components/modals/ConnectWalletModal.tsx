import React, { useState, useEffect } from 'react';
import { SUPPORTED_WALLETS, connectWallet, WalletType } from '../../services/walletService';
import { Puzzle, Laptop, Globe, Smartphone, AlertCircle, AlertTriangle, X } from 'lucide-react';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (publicKey: string, walletId: string) => void;
}

const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletsAvailability, setWalletsAvailability] = useState<Record<string, boolean>>({});

  // Check wallet availability after component mounts (gives extensions time to inject)
  useEffect(() => {
    if (isOpen) {
      // Small delay to let extensions inject
      const timer = setTimeout(() => {
        const availability: Record<string, boolean> = {};
        SUPPORTED_WALLETS.forEach(wallet => {
          availability[wallet.id] = wallet.isAvailable();
        });
        setWalletsAvailability(availability);
        console.log('Wallet availability:', availability);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getErrorMessage = (err: any, walletId: string): string => {
    if (!err) return `Failed to connect to ${walletId}`;
    if (typeof err === 'string') return err;
    
    const rawMessage = err.message || '';
    if (rawMessage.includes('[object Object]') || (typeof err === 'object' && JSON.stringify(err).includes('[object Object]'))) {
      return 'Connection request was closed or rejected by the user.';
    }

    if (err.message) {
      if (err.message.includes('User reject') || err.message.includes('declined') || err.message.includes('cancel')) {
        return 'Connection request was rejected or canceled by the user.';
      }
      return err.message;
    }
    if (err.error) return typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
    return `An unexpected error occurred while connecting to ${walletId}.`;
  };

  const handleConnect = async (walletId: WalletType) => {
    setLoading(walletId);
    setError(null);
    
    try {
      const publicKey = await connectWallet(walletId);
      onConnect(publicKey, walletId);
      onClose();
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(getErrorMessage(err, walletId));
    } finally {
      setLoading(null);
    }
  };

  const getWalletIcon = (id: string) => {
    switch (id) {
      case 'freighter':
        return <Puzzle className="w-6 h-6 text-cyan-400" />;
      case 'xbull':
        return <Laptop className="w-6 h-6 text-cyan-400" />;
      case 'albedo':
        return <Globe className="w-6 h-6 text-cyan-400" />;
      case 'lobstr':
        return <Smartphone className="w-6 h-6 text-cyan-400" />;
      default:
        return <Puzzle className="w-6 h-6 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-5 p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-400 text-sm flex items-start gap-3 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-300">Connection Failed</p>
              <p className="mt-1 text-xs text-rose-400/80 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Wallet options */}
        <div className="space-y-3">
          {SUPPORTED_WALLETS.map((wallet) => {
            const isAvailable = walletsAvailability[wallet.id] ?? wallet.isAvailable();
            const isLoading = loading === wallet.id;
            
            // Always allow clicking - will show error if not available
            return (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet.id)}
                disabled={loading !== null}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300
                  bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] cursor-pointer
                  ${isLoading ? 'ring-2 ring-cyan-500/50' : ''}
                  ${loading !== null && !isLoading ? 'opacity-40' : ''}
                `}
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  {getWalletIcon(wallet.id)}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-medium">{wallet.name}</div>
                  <div className="text-slate-400 text-xs mt-0.5">
                    {isAvailable ? 'Click to connect' : 'Click to connect (requires extension)'}
                  </div>
                </div>
                {isLoading && (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-500 border-t-transparent" />
                )}
                {!isAvailable && !isLoading && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Install
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-slate-500 text-xs">
          New to Stellar? 
          <a 
            href="https://www.stellar.org/learn/intro-to-stellar" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 ml-1 transition-colors"
          >
            Learn more
          </a>
        </p>
      </div>
    </div>
  );
};

export default ConnectWalletModal;
