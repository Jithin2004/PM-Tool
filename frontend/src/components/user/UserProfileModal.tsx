import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, Shield, Terminal, X, Lock, Activity, Users } from 'lucide-react';
import { User, Profile } from '../../types';

export function UserProfileModal({ profile, googleAvatar, onClose, onUpdate }: { profile: Profile, googleAvatar?: string | null, onClose: () => void, onUpdate: (updates: Partial<Profile>) => void }) {
  const [name, setName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ full_name: name, phone, avatar_url: avatarUrl });
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image too large. Please select a file under 2MB.");
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-bg backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface border border-border w-full max-w-md p-6 sm:p-8 overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl rounded-sm my-auto">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
          <div className="w-16 h-16 border border-border bg-white/5 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-6 h-6 text-text-quaternary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-medium tracking-tight uppercase">Identity Profile</h3>
            <p className="text-[10px] font-mono text-text-secondary uppercase tracking-wide">{profile.email}</p>
            <div className="mt-2 flex gap-2">
              <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleFileChange} />
              <label htmlFor="avatar-upload" className="text-[9px] font-mono text-signal-info border border-border px-2 py-0.5 hover:bg-surface-3 cursor-pointer transition-all">
                GALLERY_UPLOAD
              </label>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Full Name</label>
            <input
              autoFocus
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-bg border border-border h-11 px-4 font-mono text-sm focus:border-white/40 outline-none"
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Phone / Contact (10 Digits)</label>
            <input
              type="tel"
              pattern="[0-9]{10}"
              title="Please enter a full 10 digit phone number"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-bg border border-border h-11 px-4 font-mono text-sm focus:border-white/40 outline-none"
              placeholder="e.g. 1234567890"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] uppercase font-mono text-text-secondary">Profile Identity Source</label>
              <div className="flex gap-2">
                {googleAvatar && avatarUrl !== googleAvatar && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(googleAvatar)}
                    className="text-[9px] font-mono text-signal-warning border border-yellow-500/20 px-2 py-0.5 hover:bg-signal-warning-bg transition-all uppercase"
                  >
                    Restore Google
                  </button>
                )}
                <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleFileChange} />
                <label htmlFor="avatar-upload" className="text-[9px] font-mono text-signal-info border border-border px-2 py-0.5 hover:bg-surface-3 cursor-pointer transition-all uppercase">
                  [+ Gallery Photo]
                </label>
              </div>
            </div>

            {avatarUrl?.startsWith('data:image') ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-border h-11 px-4 font-mono text-[10px] flex items-center text-signal-info/80 italic">
                  LOCAL_GALLERY_OVERRIDE_ACTIVE
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="h-11 px-4 border border-red-500/30 text-signal-critical font-mono text-[9px] uppercase hover:bg-signal-critical-bg transition-all"
                >
                  Clear
                </button>
              </div>
            ) : avatarUrl === googleAvatar && googleAvatar ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-border h-11 px-4 font-mono text-[10px] flex items-center text-signal-safe/80 italic">
                  GOOGLE_ACCOUNT_LINKED
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="h-11 px-4 border border-red-500/30 text-signal-critical font-mono text-[9px] uppercase hover:bg-signal-critical-bg transition-all"
                >
                  Clear
                </button>
              </div>
            ) : (
              <input
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="w-full bg-bg border border-border h-11 px-4 font-mono text-sm focus:border-white/40 outline-none"
                placeholder="Enter image URL or upload from gallery..."
              />
            )}
          </div>

          <div className="bg-white/5 border border-border p-3 text-[10px] font-mono text-text-tertiary leading-relaxed italic border-l-2 border-l-blue-500/40">
            Note: Your profile picture is automatically synced from Google. Uploading from your gallery will create a temporary local override for this device.
          </div>
          <div className="flex gap-4">
            <button type="submit" className="flex-1 bg-white text-black h-12 font-semibold uppercase tracking-wide text-[10px] hover:bg-neutral-200 transition-all">
              Update Identity
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-border text-text-secondary h-12 font-semibold uppercase tracking-wide text-[10px] hover:bg-white/5 transition-all">
              Abort
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
