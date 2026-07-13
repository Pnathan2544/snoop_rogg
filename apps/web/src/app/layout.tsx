import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Rate Snoop - API Rate Monitor',
  description: 'Monitor API rate limits, latency, and error rates in near real time',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen bg-slate-50">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
