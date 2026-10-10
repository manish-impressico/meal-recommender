'use client';
// Bottom bar on phones, top bar ≥ lg (one component, breakpoint handled in CSS).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconFamily, IconGrocery, IconSettings, IconToday, IconWeek } from './icons';

const TABS = [
  { href: '/', label: 'Today', Icon: IconToday },
  { href: '/week', label: 'Week', Icon: IconWeek },
  { href: '/grocery', label: 'Grocery', Icon: IconGrocery },
  { href: '/family', label: 'Family', Icon: IconFamily },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
];

export function AppNav() {
  const path = usePathname();
  if (path.startsWith('/onboarding')) return null;
  return (
    <nav className="mr-nav" aria-label="Primary">
      {TABS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className={path === href ? 'active' : ''} aria-current={path === href ? 'page' : undefined}>
          <Icon size={22} strokeWidth={path === href ? 2.4 : 2} aria-hidden="true" />{label}
        </Link>
      ))}
    </nav>
  );
}
