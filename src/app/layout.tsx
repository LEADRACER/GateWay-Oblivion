// ── GateWay:Oblivion — Root Layout ─────────────────────────────────

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { SideNav } from '@/components/layout/SideNav';
import { TopBar } from '@/components/layout/TopBar';

const geistSans = Geist({
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'GateWay:Oblivion — Operations Command Center',
  description: 'Internal operations command center. Recon, scans, vulnerabilities, intelligence.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <TopBar />
          <SideNav />
          <main className="pt-12 pl-56 min-h-screen bg-bg transition-all duration-200">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
