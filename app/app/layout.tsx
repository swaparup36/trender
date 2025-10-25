import './globals.css';
import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { Navbar } from '@/components/navbar';
import WalletAdapterWrapper from '@/components/wallet-adapter-wrapper';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Fan War - Hype Your Favorite Content',
  description: 'A Solana dApp where creators post content backed by SOL liquidity',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <WalletAdapterWrapper>
        <body className={spaceGrotesk.className}>
            <Navbar />
            {children}
        </body>
      </WalletAdapterWrapper>
    </html>
  );
}
