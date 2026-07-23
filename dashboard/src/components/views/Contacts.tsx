import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Copy, 
  Check, 
  Edit, 
  Trash2, 
  Plus, 
  Download, 
  Upload, 
  Search, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { truncateAddress } from '../../lib/stellar';
import { 
  Contact, 
  getContacts, 
  saveContact, 
  deleteContact 
} from '../../services/contactsService';

interface ContactsProps {
  onCopy: (text: string) => void;
}

export const Contacts: React.FC<ContactsProps> = ({ onCopy }) => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = () => {
    setContacts(getContacts());
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = (id: string, address: string) => {
    onCopy(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = () => {
    setError('');

    if (!newName.trim()) {
      setError(t('contacts.errors.nameRequired', 'Name is required'));
      return;
    }

    if (!newAddress.trim()) {
      setError(t('contacts.errors.addressRequired', 'Stellar Address is required'));
      return;
    }

    if (!newAddress.startsWith('G') || newAddress.length !== 56) {
      setError(t('contacts.errors.invalidAddress', 'Invalid Stellar Address (must start with G and be 56 characters)'));
      return;
    }

    // Check for duplicate address (excluding current if editing)
    const existing = contacts.find(c => 
      c.address === newAddress && c.id !== editingContact?.id
    );
    if (existing) {
      setError(t('contacts.errors.duplicate', 'A contact with this address already exists'));
      return;
    }

    const contact: Contact = {
      id: editingContact?.id || Date.now().toString(),
      name: newName.trim(),
      address: newAddress.trim(),
      notes: newNotes.trim() || undefined,
      createdAt: editingContact?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    saveContact(contact);
    loadContacts();
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    if (window.confirm(t('contacts.confirmDelete', { name: contact.name }) || `Are you sure you want to delete ${contact.name}?`)) {
      deleteContact(id);
      loadContacts();
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setNewName(contact.name);
    setNewAddress(contact.address);
    setNewNotes(contact.notes || '');
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingContact(null);
    setNewName('');
    setNewAddress('');
    setNewNotes('');
    setError('');
  };

  // Export contacts list as CSV template
  const handleExportCSV = () => {
    if (contacts.length === 0) return;
    const headers = ['Name', 'Stellar Address', 'Notes'];
    const rows = contacts.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.address}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'orion-safe-contacts.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import contacts list from a CSV file
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length <= 1) return;

      let importedCount = 0;
      const updatedContacts = [...contacts];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Split by commas except commas enclosed in double quotes
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts.length >= 2) {
          const name = parts[0].replace(/^"|"$/g, '').trim();
          const address = parts[1].replace(/^"|"$/g, '').trim();
          const notes = parts[2] ? parts[2].replace(/^"|"$/g, '').trim() : undefined;

          if (name && address.startsWith('G') && address.length === 56) {
            const existingIdx = updatedContacts.findIndex(c => c.address === address);
            const contact: Contact = {
              id: existingIdx >= 0 ? updatedContacts[existingIdx].id : Date.now().toString() + '-' + i,
              name,
              address,
              notes,
              createdAt: existingIdx >= 0 ? updatedContacts[existingIdx].createdAt : Date.now(),
              updatedAt: Date.now()
            };

            saveContact(contact);
            if (existingIdx >= 0) {
              updatedContacts[existingIdx] = contact;
            } else {
              updatedContacts.push(contact);
            }
            importedCount++;
          }
        }
      }

      if (importedCount > 0) {
        loadContacts();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{t('contacts.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('contacts.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Hidden Import File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportCSV} 
            accept=".csv" 
            className="hidden" 
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 text-gray-400 hover:text-white transition flex items-center justify-center"
            title="Import Contacts CSV"
          >
            <Upload className="w-4 h-4" />
          </button>

          {contacts.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 text-gray-400 hover:text-white transition flex items-center justify-center"
              title="Export Contacts CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-semibold text-sm transition shadow-lg shadow-cyan-500/10 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t('contacts.addContact')}</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder={t('contacts.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-4 pl-12 rounded-xl bg-white/[0.02] border border-white/10 focus:border-cyan-500/30 focus:outline-none focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm transition"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
      </div>

      {/* Grid List */}
      {filteredContacts.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-12 text-center flex flex-col items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 text-gray-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
            <User className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium mb-1">
            {searchQuery ? t('contacts.empty.noMatch') : t('contacts.empty.none')}
          </p>
          <p className="text-xs text-gray-500 mb-4">No address book entries found matching query.</p>
          {!searchQuery && (
            <button
              onClick={() => setShowAddModal(true)}
              className="text-cyan-400 hover:text-cyan-300 font-semibold text-xs"
            >
              {t('contacts.empty.addFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
            const isCopied = copiedId === contact.id;

            return (
              <div
                key={contact.id}
                className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 flex flex-col justify-between gap-4 shadow-[0_4px_30px_rgba(0,0,0,0.2)]"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center font-bold text-sm text-cyan-400 flex-shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{contact.name}</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">{truncateAddress(contact.address)}</p>
                    {contact.notes && (
                      <p className="text-[11px] text-gray-400 mt-2 bg-white/[0.01] border border-white/5 px-2 py-1 rounded-lg leading-relaxed">
                        {contact.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleCopy(contact.id, contact.address)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/5 rounded-xl transition"
                    title={t('contacts.actions.copy')}
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(contact)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/5 rounded-xl transition"
                    title={t('contacts.actions.edit')}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/10 rounded-xl transition"
                    title={t('contacts.actions.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Counter */}
      <div className="text-center text-xs text-gray-500 font-medium">
        {t('contacts.savedCount', { count: contacts.length })} contacts saved in address book
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingContact ? t('contacts.modal.editTitle') : t('contacts.modal.addTitle')}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('contacts.modal.nameLabel')}</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('contacts.modal.namePlaceholder')}
                  className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/10 focus:border-cyan-500/30 focus:outline-none focus:shadow-[0_0_15px_rgba(6,182,212,0.05)] text-sm text-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('contacts.modal.addressLabel')}</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder={t('contacts.modal.addressPlaceholder')}
                  className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/10 focus:border-cyan-500/30 focus:outline-none focus:shadow-[0_0_15px_rgba(6,182,212,0.05)] font-mono text-xs text-white"
                  disabled={!!editingContact}
                />
                {editingContact && (
                  <p className="text-[10px] text-gray-500 mt-1.5">{t('contacts.modal.addressLocked')}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('contacts.modal.notesLabel')}</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder={t('contacts.modal.notesPlaceholder')}
                  rows={3}
                  className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/10 focus:border-cyan-500/30 focus:outline-none focus:shadow-[0_0_15px_rgba(6,182,212,0.05)] text-sm text-white resize-none"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-400 text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.05)]">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 transition text-sm font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white transition text-sm font-semibold shadow-lg shadow-cyan-500/10"
              >
                {editingContact ? t('contacts.modal.saveChanges') : t('contacts.addContact')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Contacts;
