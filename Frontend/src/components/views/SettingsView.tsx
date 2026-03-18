import React, { useState } from 'react';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { Eye, EyeOff, Lock, Loader2, CheckCircle2, AlertCircle, Palette, Bell, Cpu, Globe, Mail, Smartphone, Info } from 'lucide-react';
import api from '@/services/api';

// ─── Change Password form ─────────────────────────────────────────────────────

function ChangePasswordForm() {
  const [current, setCurrent]     = useState('');
  const [next, setNext]           = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showCurrent, setShowC]   = useState(false);
  const [showNext, setShowN]      = useState(false);
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const lengthOk  = next.length >= 8;
  const matchOk   = next === confirm && next.length > 0;
  const canSubmit = current.length > 0 && lengthOk && matchOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      setSuccess(true);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: any) {
      setError(err?.response?.data?.userMessage ?? 'Failed to change password. Check your current password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-sm">
      {/* Current password */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Current Password</label>
        <div className="relative">
          <input
            type={showCurrent ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter current password"
            className="w-full h-9 pl-3 pr-9 border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button type="button" onClick={() => setShowC(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* New password */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">New Password</label>
        <div className="relative">
          <input
            type={showNext ? 'text' : 'password'}
            value={next}
            onChange={e => setNext(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className={`w-full h-9 pl-3 pr-9 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
              next.length > 0 && !lengthOk ? 'border-red-300' : 'border-neutral-200'
            }`}
          />
          <button type="button" onClick={() => setShowN(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
            {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {next.length > 0 && !lengthOk && (
          <p className="text-xs text-red-500 mt-1">Minimum 8 characters required</p>
        )}
      </div>

      {/* Confirm */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Confirm New Password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="Repeat new password"
          className={`w-full h-9 pl-3 pr-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
            confirm.length > 0 && !matchOk ? 'border-red-300' : 'border-neutral-200'
          }`}
        />
        {confirm.length > 0 && !matchOk && (
          <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Password changed successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || saving}
        className="flex items-center justify-center gap-2 h-9 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? 'Saving…' : 'Update Password'}
      </button>
    </form>
  );
}

// ─── Notification toggle ──────────────────────────────────────────────────────

function NotificationToggle({ icon: Icon, title, desc, enabled }: {
  icon: React.ElementType; title: string; desc: string; enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-neutral-50 rounded-lg">
          <Icon className="w-4 h-4 text-neutral-500" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-neutral-900">{title}</h4>
          <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <button
        onClick={() => setOn(v => !v)}
        className={`w-10 h-5 rounded-full relative transition-colors ${on ? 'bg-blue-600' : 'bg-neutral-200'}`}
      >
        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SettingsView() {
  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 overflow-hidden">
      <div className="bg-white border-b border-neutral-200 px-8 py-6 flex-shrink-0">
        <h1 className="text-xl font-bold text-neutral-900">System Settings</h1>
        <p className="text-xs text-neutral-500 mt-1">Configure personal preferences and global platform parameters.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Appearance */}
          <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/50">
              <Palette className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-neutral-900">Appearance & Interface</h2>
            </div>
            <div className="p-6">
              <ThemeSettings />
              <div className="mt-6 pt-6 border-t border-neutral-100 grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Interface Density</label>
                  <p className="text-xs text-neutral-500 mb-3">Adjust spacing and size of UI elements.</p>
                  <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg w-fit">
                    <button className="px-3 py-1.5 bg-white shadow-sm rounded-md text-xs font-medium text-neutral-900">Default</button>
                    <button className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700">Compact</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Sidebar Behavior</label>
                  <p className="text-xs text-neutral-500 mb-3">Choose how the navigation bar behaves.</p>
                  <select className="w-full text-xs border border-neutral-200 rounded-lg p-2 bg-white outline-none focus:ring-1 focus:ring-blue-500">
                    <option>Always Expanded</option>
                    <option>Auto-collapse (Hover)</option>
                    <option>Icons Only</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/50">
              <Bell className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-neutral-900">Notification Preferences</h2>
            </div>
            <div className="p-6 space-y-4">
              <NotificationToggle icon={Mail} title="Email Notifications"
                desc="Receive daily summary reports and critical alerts via email." enabled={true} />
              <NotificationToggle icon={Smartphone} title="Mobile Push"
                desc="Real-time notifications on pipeline failures." enabled={false} />
            </div>
          </section>

          {/* Security — password change */}
          <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/50">
              <Lock className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-neutral-900">Security</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-1">Change Password</h3>
                <p className="text-xs text-neutral-500 mb-4">
                  Choose a strong password with at least 8 characters. Your session will remain active after changing.
                </p>
                <ChangePasswordForm />
              </div>
              <div className="pt-4 border-t border-neutral-100">
                <button className="text-xs font-semibold text-blue-600 hover:underline">
                  Manage Personal Access Tokens
                </button>
              </div>
            </div>
          </section>

          {/* Compute — locked */}
          <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden opacity-60 grayscale pointer-events-none">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/50">
              <Cpu className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-neutral-900">Compute Engine (Spark) Settings</h2>
            </div>
            <div className="p-12 text-center space-y-3">
              <Info className="w-8 h-8 text-neutral-300 mx-auto" />
              <h3 className="text-sm font-medium text-neutral-700">Cluster Configuration Locked</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Spark cluster parameters can only be modified by a System Administrator.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
