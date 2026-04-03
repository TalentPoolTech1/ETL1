import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
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
        <label className="field-label">Current Password</label>
        <div className="relative">
          <input
            type={showCurrent ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter current password"
            className="field-input pr-9"
          />
          <button type="button" onClick={() => setShowC(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--tx3)' }}>
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* New password */}
      <div>
        <label className="field-label">New Password</label>
        <div className="relative">
          <input
            type={showNext ? 'text' : 'password'}
            value={next}
            onChange={e => setNext(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="field-input pr-9"
            style={next.length > 0 && !lengthOk ? { borderColor: 'var(--err)' } : {}}
          />
          <button type="button" onClick={() => setShowN(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--tx3)' }}>
            {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {next.length > 0 && !lengthOk && (
          <p className="mt-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--err)' }}>Minimum 8 characters required</p>
        )}
      </div>

      {/* Confirm */}
      <div>
        <label className="field-label">Confirm New Password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="Repeat new password"
          className="field-input"
          style={confirm.length > 0 && !matchOk ? { borderColor: 'var(--err)' } : {}}
        />
        {confirm.length > 0 && !matchOk && (
          <p className="mt-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--err)' }}>Passwords do not match</p>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--err)', background: 'var(--err-bg)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--ok)', background: 'var(--ok-bg)', border: '1px solid rgba(52,211,153,0.25)' }}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Password changed successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || saving}
        className="panel-btn panel-btn-primary flex items-center justify-center gap-2"
        style={{ height: 36, paddingLeft: 20, paddingRight: 20 }}
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
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg" style={{ background: 'var(--bg-5)' }}>
          <Icon className="w-4 h-4" style={{ color: 'var(--tx2)' }} />
        </div>
        <div>
          <h4 className="thm-heading-3">{title}</h4>
          <p className="mt-0.5" style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)' }}>{desc}</p>
        </div>
      </div>
      <button
        onClick={() => setOn(v => !v)}
        className="w-10 h-5 rounded-full relative transition-colors flex-shrink-0"
        style={{ background: on ? 'var(--ac)' : 'var(--bg-6)' }}
      >
        <div className="absolute top-1 w-3 h-3 rounded-full transition-all shadow-sm"
          style={{ background: 'var(--tx1)', left: on ? 24 : 4 }} />
      </button>
    </div>
  );
}

// ─── Compute Settings Form ────────────────────────────────────────────────────

function ComputeSettingsForm() {
  const [sparkMaster, setSparkMaster]   = useState('');
  const [pysparkPath, setPysparkPath]   = useState('');
  const [scalaVersion, setScalaVersion] = useState('');
  const [pythonVersion, setPythonVersion] = useState('');
  const [additionalLibraries, setAdditionalLibs] = useState('');
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.getComputeSettings().then(res => {
      const data = res.data?.data || {};
      setSparkMaster(data.sparkMaster || '');
      setPysparkPath(data.pysparkPath || '');
      setScalaVersion(data.scalaVersion || '');
      setPythonVersion(data.pythonVersion || '');
      setAdditionalLibs(data.additionalLibraries || '');
      setLoading(false);
    }).catch((err: any) => {
      setError('Failed to load compute settings.');
      setLoading(false);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.updateComputeSettings({
        sparkMaster,
        pysparkPath,
        scalaVersion,
        pythonVersion,
        additionalLibraries
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.userMessage ?? 'Failed to update compute settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Spark Name Node (Master URL)</label>
          <input type="text" value={sparkMaster} onChange={e => setSparkMaster(e.target.value)} placeholder="e.g. spark://master:7077 or yarn" className="field-input" />
        </div>
        <div>
          <label className="field-label">Local PySpark Path</label>
          <input type="text" value={pysparkPath} onChange={e => setPysparkPath(e.target.value)} placeholder="e.g. /opt/spark" className="field-input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Scala Version</label>
          <input type="text" value={scalaVersion} onChange={e => setScalaVersion(e.target.value)} placeholder="e.g. 2.12" className="field-input" />
        </div>
        <div>
          <label className="field-label">Python Version</label>
          <input type="text" value={pythonVersion} onChange={e => setPythonVersion(e.target.value)} placeholder="e.g. 3.10" className="field-input" />
        </div>
      </div>

      <div>
        <label className="field-label">Additional Libraries (maven coordinates)</label>
        <input type="text" value={additionalLibraries} onChange={e => setAdditionalLibs(e.target.value)} placeholder="org.postgresql:postgresql:42.5.0, ..." className="field-input" />
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--err)', background: 'var(--err-bg)', border: '1px solid rgba(248,113,113,0.25)' }}><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--ok)', background: 'var(--ok-bg)', border: '1px solid rgba(52,211,153,0.25)' }}><CheckCircle2 className="w-4 h-4 flex-shrink-0" />Successfully updated compute settings.</div>}

      <div className="pt-2">
        <button type="submit" disabled={saving} className="panel-btn panel-btn-primary flex items-center justify-center gap-2" style={{ height: 36, paddingLeft: 20, paddingRight: 20 }}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : 'Save Compute Settings'}
        </button>
      </div>
    </form>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SettingsView() {
  const permissions = useSelector((state: RootState) => state.auth.permissions);
  const isAdmin = permissions.includes('USER_MANAGE');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Page header */}
      <div className="flex-shrink-0 px-8 py-5" style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--bd)' }}>
        <h1 className="thm-heading-1">System Settings</h1>
        <p className="mt-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)' }}>Configure personal preferences and global platform parameters.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

          {/* Appearance */}
          <section className="panel-card xl:col-span-7">
            <div className="flex items-center gap-2 pb-4" style={{ borderBottom: '1px solid var(--bd)' }}>
              <Palette className="w-4 h-4" style={{ color: 'var(--ac)' }} />
              <h2 className="thm-heading-2">Appearance &amp; Interface</h2>
            </div>
            <div className="pt-2">
              <ThemeSettings />
              <div className="mt-6 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8" style={{ borderTop: '1px solid var(--bd)' }}>
                <div>
                  <label className="field-label uppercase tracking-wider">Interface Density</label>
                  <p className="mb-3" style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)' }}>Adjust spacing and size of UI elements.</p>
                  <div className="flex gap-2 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-5)' }}>
                    <button className="px-3 py-1.5 rounded-md panel-btn" style={{ fontSize: 'var(--fs-sm)' }}>Default</button>
                    <button className="px-3 py-1.5 rounded-md" style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)', background: 'transparent', border: 'none' }}>Compact</button>
                  </div>
                </div>
                <div>
                  <label className="field-label uppercase tracking-wider">Sidebar Behavior</label>
                  <p className="mb-3" style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)' }}>Choose how the navigation bar behaves.</p>
                  <select className="field-select">
                    <option>Always Expanded</option>
                    <option>Auto-collapse (Hover)</option>
                    <option>Icons Only</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="panel-card xl:col-span-5">
            <div className="flex items-center gap-2 pb-4" style={{ borderBottom: '1px solid var(--bd)' }}>
              <Bell className="w-4 h-4" style={{ color: 'var(--ac)' }} />
              <h2 className="thm-heading-2">Notification Preferences</h2>
            </div>
            <div className="pt-2 space-y-4">
              <NotificationToggle icon={Mail} title="Email Notifications"
                desc="Receive daily summary reports and critical alerts via email." enabled={true} />
              <NotificationToggle icon={Smartphone} title="Mobile Push"
                desc="Real-time notifications on pipeline failures." enabled={false} />
            </div>
          </section>

          {/* Security */}
          <section className="panel-card xl:col-span-5">
            <div className="flex items-center gap-2 pb-4" style={{ borderBottom: '1px solid var(--bd)' }}>
              <Lock className="w-4 h-4" style={{ color: 'var(--ac)' }} />
              <h2 className="thm-heading-2">Security</h2>
            </div>
            <div className="pt-2 space-y-6">
              <div>
                <h3 className="thm-heading-3 mb-1">Change Password</h3>
                <p className="mb-4" style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)' }}>
                  Choose a strong password with at least 8 characters. Your session will remain active after changing.
                </p>
                <ChangePasswordForm />
              </div>
              <div className="pt-4" style={{ borderTop: '1px solid var(--bd)' }}>
                <button className="thm-link" style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semi)' }}>
                  Manage Personal Access Tokens
                </button>
              </div>
            </div>
          </section>

          {/* Compute */}
          <section className={`panel-card xl:col-span-7 ${!isAdmin ? 'opacity-60 grayscale' : ''}`}>
            <div className="flex items-center gap-2 pb-4" style={{ borderBottom: '1px solid var(--bd)' }}>
              <Cpu className="w-4 h-4" style={{ color: 'var(--ac)' }} />
              <h2 className="thm-heading-2">Compute Engine (Spark) Settings</h2>
            </div>
            {isAdmin ? (
              <div className="pt-2">
                <ComputeSettingsForm />
              </div>
            ) : (
              <div className="py-10 text-center space-y-3 pointer-events-none">
                <Info className="w-8 h-8 mx-auto" style={{ color: 'var(--tx3)' }} />
                <h3 className="thm-heading-3">Cluster Configuration Locked</h3>
                <p className="max-w-sm mx-auto" style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)' }}>
                  Spark cluster parameters can only be modified by a System Administrator.
                </p>
              </div>
            )}
          </section>

          </div>
        </div>
      </div>
    </div>
  );
}
