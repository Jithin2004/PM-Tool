import React, { useState } from 'react';
import { X, Building2, User, Mail, Phone, Users, ShieldCheck } from 'lucide-react';
import { commercialRequestService, CommercialRequest } from '../../services/commercialRequestService';
import { showConfirm, showAlert } from '../../components/common/Dialogs';

export interface CommercialRequestModalProps {
  mode: 'demo' | 'license';
  selectedPlan?: string;
  onClose: () => void;
}

export function CommercialRequestModal({ mode, selectedPlan, onClose }: CommercialRequestModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    company: '',
    phone: '',
    role: '',
    companySize: '1-10'
  });
  
  const [submitting, setSubmitting] = useState(false);

  const isDemo = mode === 'demo';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const confirmTitle = isDemo ? "Confirm Submission" : "Confirm License Request";
    const confirmMessage = isDemo 
      ? "Submit demo request?" 
      : "Submit license request?";

    if (await showConfirm(confirmMessage, { title: confirmTitle, confirmText: 'Submit' })) {
      setSubmitting(true);
      
      const requestPayload: CommercialRequest = {
        type: mode,
        fullName: formData.fullName,
        email: formData.email,
        company: formData.company,
        phone: formData.phone || undefined,
        role: formData.role,
        companySize: formData.companySize,
        selectedPlan: selectedPlan,
        createdAt: new Date().toISOString()
      };

      try {
        await commercialRequestService.submitRequest(requestPayload);
        
        onClose();
        
        const successMessage = isDemo 
          ? "Demo request received. Our team will provide access details." 
          : "License request received. Our team will contact you with activation details.";
          
        showAlert(successMessage, { title: 'Success', type: 'success' });
      } catch (error) {
        showAlert("There was an error submitting your request. Please try again.", { title: 'Error', type: 'error' });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[#11131a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isDemo ? 'Request Demo Access' : 'Request License'}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {isDemo ? 'Experience Resolve PM firsthand.' : `Licensing configuration for ${selectedPlan || 'Enterprise'}.`}
            </p>
          </div>
          <button 
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto">
          <form id="commercial-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={14} className="text-zinc-500" />
                  </div>
                  <input
                    required
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Work Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={14} className="text-zinc-500" />
                  </div>
                  <input
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors"
                    placeholder="jane@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Company</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 size={14} className="text-zinc-500" />
                  </div>
                  <input
                    required
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors"
                    placeholder="Acme Corp"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Phone (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone size={14} className="text-zinc-500" />
                  </div>
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Your Role</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ShieldCheck size={14} className="text-zinc-500" />
                  </div>
                  <input
                    required
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors"
                    placeholder="e.g. CTO, Operations"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Company Size</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users size={14} className="text-zinc-500" />
                  </div>
                  <select
                    required
                    name="companySize"
                    value={formData.companySize}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-colors appearance-none"
                  >
                    <option value="1-10" className="bg-[#11131a]">1-10 employees</option>
                    <option value="11-50" className="bg-[#11131a]">11-50 employees</option>
                    <option value="51-200" className="bg-[#11131a]">51-200 employees</option>
                    <option value="201-500" className="bg-[#11131a]">201-500 employees</option>
                    <option value="500+" className="bg-[#11131a]">500+ employees</option>
                  </select>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-black/20 shrink-0">
          <button
            form="commercial-form"
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-indigo-500/20"
          >
            {submitting ? 'Submitting...' : isDemo ? 'Request Demo Access' : 'Request License'}
          </button>
        </div>
      </div>
    </div>
  );
}
