'use client';

// ── GateWay:Oblivion — Auth Gate (redirect wrapper) ────────────────

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
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
