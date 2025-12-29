// app/components/NavBar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/invoices', label: 'الفواتير' },
  { href: '/expenses', label: 'المصاريف' },
  { href: '/customers', label: 'الزبائن' },
  { href: '/items', label: 'العناصر' },
  { href: '/service-types', label: 'الخدمات' },
  { href: '/item-prices', label: 'اسعار الخدمات' },
  
  // later: { href: '/expenses', label: 'Expenses' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-slate-900">
            Al Mukhtar Laundry
          </span>
          <span className="text-xs uppercase tracking-wide text-slate-400">
            POS
          </span>
        </div>

        {/* Links */}
        <div className="flex gap-2">
          {links.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}