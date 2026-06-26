'use client';

// ── GateWay:Oblivion — New Vulnerability Page ─────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateVuln } from '@/hooks/useVulnerabilities';

export default function NewVulnPage() {
  const router = useRouter();
  const createVuln = useCreateVuln();

  const [form, setForm] = useState({
    cve_id: '',
    title: '',
    description: '',
    severity: 'medium',
    cvss_score: 0,
    affected_device: '',
    affected_port: 0,
    affected_service: '',
    exploitability: 'none',
    remediation: '',
  });

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    createVuln.mutate(
      { ...form, cvss_score: Number(form.cvss_score) || 0 },
      {
        onSuccess: (data) => {
          router.push(`/vulnerabilities/${data.id}`);
        },
      }
    );
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-mono text-lg text-text tracking-tight">New Vulnerability</h1>
      </div>

      <div className="border border-border bg-surface p-6">
        <div className="flex flex-col gap-4">
          <FormField label="CVE ID">
            <input
              value={form.cve_id}
              onChange={(e) => handleChange('cve_id', e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
              placeholder="CVE-2024-XXXXX"
            />
          </FormField>

          <FormField label="Title">
            <input
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
              placeholder="Vulnerability title"
            />
          </FormField>

          <FormField label="Description">
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent h-24 resize-none"
            />
          </FormField>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Severity">
              <select
                value={form.severity}
                onChange={(e) => handleChange('severity', e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none"
              >
                {['critical', 'high', 'medium', 'low', 'info'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FormField>

            <FormField label="CVSS Score">
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={form.cvss_score}
                onChange={(e) => handleChange('cvss_score', parseFloat(e.target.value) || 0)}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
              />
            </FormField>

            <FormField label="Exploitability">
              <select
                value={form.exploitability}
                onChange={(e) => handleChange('exploitability', e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none"
              >
                {['none', 'proof-of-concept', 'functional', 'weaponized'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Affected Device">
              <input
                value={form.affected_device}
                onChange={(e) => handleChange('affected_device', e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
                placeholder="IP address"
              />
            </FormField>

            <FormField label="Affected Port">
              <input
                type="number"
                min="0"
                max="65535"
                value={form.affected_port || ''}
                onChange={(e) => handleChange('affected_port', parseInt(e.target.value) || 0)}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
              />
            </FormField>

            <FormField label="Service">
              <input
                value={form.affected_service}
                onChange={(e) => handleChange('affected_service', e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
                placeholder="http, ssh, mysql…"
              />
            </FormField>
          </div>

          <FormField label="Remediation">
            <textarea
              value={form.remediation}
              onChange={(e) => handleChange('remediation', e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent h-20 resize-none"
            />
          </FormField>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => router.push('/vulnerabilities')}
              className="font-mono text-[10px] tracking-widest text-text border border-border px-4 py-2 hover:bg-surface-2 transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSubmit}
              disabled={!form.cve_id || !form.title || createVuln.isPending}
              className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {createVuln.isPending ? 'CREATING…' : 'CREATE VULNERABILITY'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">{label}</label>
      {children}
    </div>
  );
}
