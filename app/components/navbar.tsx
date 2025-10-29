'use client';

import Link from 'next/link';
import { Flame } from 'lucide-react';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from '@solana/wallet-adapter-react';
import { isAdmin } from '@/lib/config';

export function Navbar() {
  const walletCtx = useWallet();
  
  const walletBtnStyle: React.CSSProperties = {
    padding: '0.75rem 2rem',
    borderRadius: '9999px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    color: '#ffffff',
    background: 'linear-gradient(to right, #06b6d4 0%, #ec4899 100%)' /* from-cyan-500 to-pink-500 */,
    transition: 'background 0.2s ease, box-shadow 0.15s ease, transform 0.08s ease',
    cursor: 'pointer',
    border: 'none',
    boxShadow: '0 6px 20px rgba(99,102,241,0.08), 0 0 20px rgba(236,72,153,0.06), 0 0 40px rgba(6,182,212,0.04)',
    whiteSpace: 'nowrap',
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-pink-500 neon-glow">
              <Flame className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-green-400 bg-clip-text text-transparent">
              TRENDER
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-cyan-400 transition-colors">
              Feed
            </Link>
            <Link href="/trending" className="text-sm font-medium hover:text-orange-400 transition-colors">
              Trending
            </Link>
            <Link href="/create" className="text-sm font-medium hover:text-pink-400 transition-colors">
              Create
            </Link>
            <Link href="/dashboard" className="text-sm font-medium hover:text-green-400 transition-colors">
              Dashboard
            </Link>
            {walletCtx.connected && walletCtx.publicKey && isAdmin(walletCtx.publicKey.toBase58()) && (
              <Link href="/admin" className="text-sm font-medium hover:text-orange-400 transition-colors">
                Admin
              </Link>
            )}

            <WalletMultiButton
              style={walletBtnStyle}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
