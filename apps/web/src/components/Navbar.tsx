'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">📡</span>
            <span className="text-xl font-bold text-slate-900">Rate Snoop</span>
          </Link>

          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/"
              className={`font-medium transition-colors ${
                pathname === '/'
                  ? 'text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Projects
            </Link>
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-700 transition-colors"
            >
              API Docs
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
