'use client';

// ── GateWay:Oblivion — New Operation Page ─────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateOperation, useRunbooks } from '@/hooks/useOperations';

const OP_TYPES = [
  { value: 'scan', label: 'Scan', desc: 'Trigger a NetVision scan on a target' },
  { value: 'command', label: 'Command', desc: 'Execute a shell command (ping, nmap, etc.)' },
  { value: 'runbook', label: 'Runbook', desc: 'Execute a multi-step runbook workflow' },
  { value: 'manual', label: 'Manual', desc: 'Track a manual operation externally' },
];

const COMMAND_PRESETS = [
  { label: 'Ping', command: 'ping', flags: '-c 4' },
  { label: 'DNS Lookup', command: 'nslookup', flags: '' },
  { label: 'Nmap Quick', command: 'nmap', flags: '-sn' },
  { label: 'Port Scan', command: 'nmap', flags: '-sV' },
];

export default function NewOperationPage() {
  const router = useRouter();
  const createOp = useCreateOperation();
  const { data: runbooks = [] } = useRunbooks();

  const [type, setType] = useState('scan');
  const [name, setName] = useState('');
  const [targetRef, setTargetRef] = useState('');
  const [profile, setProfile] = useState('quick');
  const [command, setCommand] = useState('ping');
  const [commandFlags, setCommandFlags] = useState('-c 4');
  const [selectedRunbook, setSelectedRunbook] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  const handleSubmit = () => {
    const params: Record<string, unknown> = {};

    if (type === 'scan') {
      params.profile = profile;
    } else if (type === 'command') {
      params.command = command;
      params.flags = commandFlags;
    } else if (type === 'runbook') {
      params.runbook = selectedRunbook;
    }

    createOp.mutate(
      {
        name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} — ${new Date().toLocaleString()}`,
        operation_type: type,
        target_ref: targetRef,
        parameters: params,
      },
      {
        onSuccess: (data) => {
          router.push(`/operations/${data.id}`);
        },
      }
    );
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-mono text-lg text-text tracking-tight">New Operation</h1>
      </div>

      <div className="border border-border bg-surface p-6">
        <div className="flex flex-col gap-5">
          {/* Operation Type */}
          <div>
            <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-2 block">Operation Type</label>
            <div className="grid grid-cols-4 gap-2">
              {OP_TYPES.map((ot) => (
                <button
                  key={ot.value}
                  onClick={() => setType(ot.value)}
                  className={`p-3 border text-left transition-colors ${
                    type === ot.value
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-text-dim'
                  }`}
                >
                  <div className={`font-mono text-xs ${type === ot.value ? 'text-accent' : 'text-text'}`}>
                    {ot.label}
                  </div>
                  <div className="font-mono text-[8px] text-text-dim mt-1">{ot.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">Operation Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
              placeholder="Auto-generated if empty"
            />
          </div>

          {/* Target */}
          {type !== 'manual' && (
            <div>
              <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">
                Target {type === 'scan' ? 'IP / CIDR / Hostname' : 'IP / Hostname'}
              </label>
              <input
                value={targetRef}
                onChange={(e) => setTargetRef(e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
                placeholder={type === 'scan' ? '10.0.1.10 or 10.0.0.0/24' : '10.0.1.10'}
              />
            </div>
          )}

          {/* Scan-specific */}
          {type === 'scan' && (
            <div>
              <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">Scan Profile</label>
              <div className="flex gap-2">
                {['quick', 'deep', 'full'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setProfile(p)}
                    className={`px-4 py-2 border font-mono text-[10px] tracking-wider transition-colors ${
                      profile === p
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-text-dim hover:text-text'
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Command-specific */}
          {type === 'command' && (
            <>
              <div>
                <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">Command Presets</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COMMAND_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setCommand(preset.command);
                        setCommandFlags(preset.flags);
                      }}
                      className={`px-3 py-1.5 border font-mono text-[9px] tracking-wider transition-colors ${
                        command === preset.command && commandFlags === preset.flags
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-dim hover:text-text'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">Command</label>
                  <input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">Flags</label>
                  <input
                    value={commandFlags}
                    onChange={(e) => setCommandFlags(e.target.value)}
                    className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </>
          )}

          {/* Runbook-specific */}
          {type === 'runbook' && (
            <div>
              <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">Runbook Template</label>
              <div className="flex flex-col gap-2">
                {runbooks.map((rb) => (
                  <button
                    key={rb.name}
                    onClick={() => setSelectedRunbook(rb.name)}
                    className={`p-3 border text-left transition-colors ${
                      selectedRunbook === rb.name
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-text-dim'
                    }`}
                  >
                    <div className={`font-mono text-xs ${selectedRunbook === rb.name ? 'text-accent' : 'text-text'}`}>
                      {rb.name}
                    </div>
                    <div className="font-mono text-[9px] text-text-dim mt-1">{rb.description}</div>
                    <div className="font-mono text-[8px] text-text-dim mt-0.5">
                      {rb.steps.length} steps
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual-specific */}
          {type === 'manual' && (
            <div>
              <label className="font-mono text-[9px] tracking-wider text-text-dim uppercase mb-1 block">Description</label>
              <textarea
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent h-24 resize-none"
                placeholder="Describe the manual operation and any notable findings"
              />
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => router.push('/operations')}
              className="font-mono text-[10px] tracking-widest text-text border border-border px-4 py-2 hover:bg-surface-2 transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                createOp.isPending ||
                (type === 'runbook' && !selectedRunbook)
              }
              className="font-mono text-[10px] tracking-widest text-bg bg-accent px-4 py-2 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {createOp.isPending ? 'CREATING…' : 'CREATE & EXECUTE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
