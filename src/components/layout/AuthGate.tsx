'use client';

// ── GateWay:Oblivion — Auth Gate (redirect wrapper) ────────────────

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const AUTH_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(!AUTH_CONFIGURED);
  const [authenticated, setAuthenticated] = useState(AUTH_CONFIGURED);
  const router = useRouter();

  useEffect(() => {
    // Server onboarding: only run the Supabase auth gate when configured.
    // Local-only installs render the console directly.
    if (!AUTH_CONFIGURED) return;

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
      } else {
        setAuthenticated(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      } else if (session?.user) {
        setAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-border border-t-accent animate-spin rounded-full" />
          <span className="font-mono text-xs text-text-muted">AUTHENTICATING...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
