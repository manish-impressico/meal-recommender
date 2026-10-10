'use client';
// AppShell nav: bottom bar on phones, top bar ≥ lg (one component, breakpoint-parameterized via CSS).
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Today' },
  { href: '/week', label: 'Week' },
  { href: '/grocery', label: 'Grocery' },
  { href: '/family', label: 'Family' },
  { href: '/settings', label: 'Settings' },
];

export function AppNav() {
  const path = usePathname();
  if (path.startsWith('/onboarding')) return null;
  return (
    <nav className="mr-nav" aria-label="Primary">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? 'active' : ''} aria-current={path === t.href ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
