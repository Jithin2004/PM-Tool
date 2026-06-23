import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Shield, Terminal, X, Lock, Activity, Users } from 'lucide-react';
import { User, Profile } from '../../types';
import { showAlert, showConfirm, showPrompt } from '../../components/common/Dialogs';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export function UserProfileModal({ profile, onClose, onUpdate }: { profile: Profile, onClose: () => void, onUpdate: (updates: Partial<Profile>) => void }) {
  const [name, setName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');

  useEscapeKey(true, onClose);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ full_name: name, phone, avatar_url: avatarUrl });
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showAlert("Image too large. Please select a file under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 modal-overlay-premium" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative modal-premium w-full max-w-md p-6 sm:p-8 overflow-y-auto max-h-[90vh] md:max-h-none rounded-2xl my-auto"
      >
        <button onClick={onClose} aria-label="Close modal" className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[var(--border-soft)]">
          <div className="w-16 h-16 border border-[var(--border-soft)] bg-[var(--surface-glass)] rounded-xl flex items-center justify-center overflow-hidden shadow-inner">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-6 h-6 text-[var(--text-secondary)]" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold tracking-tight text-white">Identity Profile</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{profile.email}</p>
            <div className="mt-3 flex gap-2">
              <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleFileChange} />
              <label htmlFor="avatar-upload" className="text-[10px] font-bold text-purple-400 border border-purple-500/30 rounded-lg px-3 py-1.5 hover:bg-purple-500/10 cursor-pointer transition-all uppercase tracking-wider">
                Upload New Image
              </label>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-2">Full Name</label>
            <input
              autoFocus
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-premium w-full h-12 px-4 rounded-xl text-sm outline-none text-white transition-all"
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-2">Phone / Contact</label>
            <input
              type="tel"
              pattern="[0-9]{10}"
              title="Please enter a full 10 digit phone number"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="input-premium w-full h-12 px-4 rounded-xl text-sm outline-none text-white transition-all"
              placeholder="e.g. 1234567890"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">Profile Source Overrides</label>
              <div className="flex gap-2">
                <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleFileChange} />
                <label htmlFor="avatar-upload" className="text-[10px] font-bold text-purple-400 border border-purple-500/20 rounded-lg px-2 py-1 hover:bg-purple-500/10 cursor-pointer transition-all uppercase tracking-wider">
                  Select Photo
                </label>
              </div>
            </div>

            {avatarUrl?.startsWith('data:image') ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-xl h-12 px-4 text-xs flex items-center text-purple-400 font-mono">
                  Local override active
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="h-12 px-4 rounded-xl border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider hover:bg-rose-500/10 transition-all cursor-pointer"
                >
                  Clear
                </button>
              </div>
            ) : (
              <input
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="input-premium w-full h-12 px-4 rounded-xl text-sm outline-none text-white transition-all"
                placeholder="Enter image URL or upload from gallery..."
              />
            )}
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-xs text-purple-200/80 leading-relaxed shadow-inner">
            Note: Uploading from your gallery will create a local override for this device.
          </div>
          <div className="flex gap-4 pt-4">
            <button type="submit" className="flex-1 btn-premium-primary h-12 text-xs font-bold uppercase tracking-wider">
              Update Identity
            </button>
            <button type="button" onClick={onClose} className="flex-1 btn-premium-secondary h-12 text-xs font-bold uppercase tracking-wider">
              Abort
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

