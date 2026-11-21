'use client';

// ── GateWay:Oblivion — Side Navigation ─────────────────────────────

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebarStore } from '@/stores/operations';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Overview',
    href: '/',
    icon: <GridIcon />,
  },
  {
    label: 'Recon',
    href: '/recon',
    icon: <SatelliteIcon />,
  },
  {
    label: 'Targets',
    href: '/targets',
    icon: <CrosshairsIcon />,
  },
  {
    label: 'Scans',
    href: '/scans',
    icon: <RadarIcon />,
  },
  {
    label: 'Vulnerabilities',
    href: '/vulnerabilities',
    icon: <BugIcon />,
  },
  {
    label: 'Operations',
    href: '/operations',
    icon: <TerminalIcon />,
  },
  {
    label: 'Intelligence',
    href: '/intelligence',
    icon: <ChipIcon />,
  },
  {
    label: 'Tools',
    href: '/tools',
    icon: <TerminalIcon />,
  },
  {
    label: 'Pipelines',
    href: '/pipelines',
    icon: <FlowIcon />,
  },
  {
    label: 'OSINT',
    href: '/osint',
    icon: <SatelliteIcon />,
  },
  {
    label: 'Obsidian',
    href: '/obsidian',
    icon: <BookIcon />,
  },
];

export function SideNav() {
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <aside
      className={`fixed left-0 top-12 bottom-0 z-30 border-r border-border bg-surface transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <nav className="flex flex-col py-3 gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 mx-2 px-3 py-2 rounded transition-colors ${
                isActive
                  ? 'bg-accent-bg text-accent'
                  : 'text-text-muted hover:text-text hover:bg-surface-2'
              }`}
            >
              <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                {item.icon}
              </span>
              {!collapsed && (
                <span className="font-mono text-xs tracking-wide">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// ── Icons (inline SVG, minimal) ────────────────────────────────────

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="1" width="5" height="5" rx="0.5" />
      <rect x="8" y="1" width="5" height="5" rx="0.5" />
      <rect x="1" y="8" width="5" height="5" rx="0.5" />
      <rect x="8" y="8" width="5" height="5" rx="0.5" />
    </svg>
  );
}

function SatelliteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2" />
      <path d="M3.5 3.5l1.5 1.5M9 9l1.5 1.5" strokeDasharray="1 1" />
    </svg>
  );
}

function CrosshairsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" />
      <path d="M7 1v3M7 10v3M1 7h3M10 7h3" strokeLinecap="round" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" />
      <path d="M7 7 10 4M7 7l-4-1" strokeLinecap="round" />
      <path d="M7 2a5 5 0 0 1 5 5" strokeDasharray="1 1" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 3.5a2 2 0 0 1 4 0V5a2 2 0 0 1-4 0z" />
      <path d="M3 7h8M4 5l-2-2M10 5l2-2M4 9l-2 2M10 9l2 2" />
      <path d="M7 7v5" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="m4 5 2.5 2L4 9M8 9h2" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <path d="M5 1v2M9 1v2M5 11v2M9 11v2M1 5h2M1 9h2M11 5h2M11 9h2" />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="1" width="4" height="4" rx="0.5" />
      <rect x="9" y="1" width="4" height="4" rx="0.5" />
      <rect x="5" y="9" width="4" height="4" rx="0.5" />
      <path d="M3 5v2h8V5M7 7v2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 2h4a2 2 0 0 1 2 2v8a2 2 0 0 0-2-2H2z" />
      <path d="M12 2H8a2 2 0 0 0-2 2v8a2 2 0 0 1 2-2h4z" />
    </svg>
  );
}
