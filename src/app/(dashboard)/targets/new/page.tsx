'use client';

// ── GateWay:Oblivion — New Target Page ─────────────────────────────

import { useRouter } from 'next/navigation';
import { TargetForm } from '@/components/targets/TargetForm';
import { useCreateTarget } from '@/hooks/useTargets';
import type { Target } from '@/lib/types/database';

export default function NewTargetPage() {
  const router = useRouter();
  const createTarget = useCreateTarget();

  const handleSubmit = async (data: Partial<Target>) => {
    try {
      await createTarget.mutateAsync(data);
      router.push('/targets');
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg text-text tracking-tight">Add Target</h1>
          <p className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
            Register a new asset or objective
          </p>
        </div>
      </div>

      <div className="max-w-2xl border border-border bg-surface p-6">
        <TargetForm
          onSubmit={handleSubmit}
          onCancel={() => router.push('/targets')}
          loading={createTarget.isPending}
        />
      </div>
    </div>
  );
}
