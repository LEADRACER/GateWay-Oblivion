'use client';

// ── GateWay:Oblivion — Login Page ──────────────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="w-full max-w-sm border border-border bg-surface p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="font-mono text-lg tracking-[0.2em] text-accent mb-1">OBLIVION</div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-text-dim uppercase">
            Operations Command Center
          </div>
          <div className="mt-6 border-t border-border" />
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
              placeholder="operator@oblivion"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] tracking-widest text-text-dim uppercase">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg border border-border px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="font-mono text-[10px] text-danger tracking-wide">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-bg font-mono text-xs tracking-widest uppercase py-2.5 hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? 'AUTHENTICATING...' : 'ENTER'}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4">
          <p className="font-mono text-[9px] text-text-dim text-center tracking-wider">
            Authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
}
