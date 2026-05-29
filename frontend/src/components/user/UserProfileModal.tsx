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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative bg-surface/80 backdrop-blur-xl border border-border/50 w-full max-w-md p-6 sm:p-8 overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl shadow-black/50 rounded-2xl my-auto"
      >
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/50">
          <div className="w-16 h-16 border border-border/50 bg-surface-3/50 rounded-xl flex items-center justify-center overflow-hidden shadow-inner">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-6 h-6 text-text-quaternary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold tracking-tight text-text-primary">Identity Profile</h3>
            <p className="text-xs text-text-tertiary mt-0.5">{profile.email}</p>
            <div className="mt-3 flex gap-2">
              <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleFileChange} />
              <label htmlFor="avatar-upload" className="text-[10px] font-bold text-blue-400 border border-blue-500/30 rounded-lg px-3 py-1.5 hover:bg-blue-500/10 cursor-pointer transition-all uppercase tracking-wider">
                Upload New Image
              </label>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary mb-2">Full Name</label>
            <input
              autoFocus
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm focus:border-teal-500/50 outline-none text-text-primary transition-all"
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary mb-2">Phone / Contact</label>
            <input
              type="tel"
              pattern="[0-9]{10}"
              title="Please enter a full 10 digit phone number"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm focus:border-teal-500/50 outline-none text-text-primary transition-all"
              placeholder="e.g. 1234567890"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] uppercase tracking-widest font-bold text-text-secondary">Profile Source Overrides</label>
              <div className="flex gap-2">
                {googleAvatar && avatarUrl !== googleAvatar && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(googleAvatar)}
                    className="text-[10px] font-bold text-yellow-500 border border-yellow-500/20 rounded-lg px-2 py-1 hover:bg-yellow-500/10 transition-all uppercase tracking-wider"
                  >
                    Restore Google
                  </button>
                )}
                <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleFileChange} />
                <label htmlFor="avatar-upload" className="text-[10px] font-bold text-blue-400 border border-blue-500/20 rounded-lg px-2 py-1 hover:bg-blue-500/10 cursor-pointer transition-all uppercase tracking-wider">
                  Select Photo
                </label>
              </div>
            </div>

            {avatarUrl?.startsWith('data:image') ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-surface-3/50 border border-border/50 rounded-xl h-12 px-4 text-xs flex items-center text-blue-400">
                  Local override active
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="h-12 px-4 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/10 transition-all"
                >
                  Clear
                </button>
              </div>
            ) : avatarUrl === googleAvatar && googleAvatar ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-surface-3/50 border border-border/50 rounded-xl h-12 px-4 text-xs flex items-center text-emerald-400">
                  Google account linked
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="h-12 px-4 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/10 transition-all"
                >
                  Clear
                </button>
              </div>
            ) : (
              <input
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="w-full bg-surface-3/50 border border-border/50 h-12 px-4 rounded-xl text-sm focus:border-teal-500/50 outline-none text-text-primary transition-all"
                placeholder="Enter image URL or upload from gallery..."
              />
            )}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-200/80 leading-relaxed shadow-inner">
            Note: Your profile picture is automatically synced from Google. Uploading from your gallery will create a temporary local override for this device.
          </div>
          <div className="flex gap-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-teal-500 text-white h-12 rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg hover:from-blue-500 hover:to-teal-400 hover:shadow-teal-500/25 transition-all">
              Update Identity
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-border/50 text-text-secondary h-12 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-surface-3 hover:text-text-primary transition-all">
              Abort
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
