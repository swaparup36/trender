export function getAdminAddress(): string | null {
  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_ADDRESS;
  
  if (!adminAddress || adminAddress === 'YOUR_ADMIN_WALLET_ADDRESS_HERE') {
    console.warn('Admin address not configured. Please set NEXT_PUBLIC_ADMIN_ADDRESS in your environment variables.');
    return null;
  }
  
  return adminAddress;
}

export function isAdmin(walletAddress: string | null): boolean {
  if (!walletAddress) return false;
  
  const adminAddress = getAdminAddress();
  if (!adminAddress) return false;
  
  return walletAddress === adminAddress;
}

export const config = {
  get adminAddress() {
    return getAdminAddress();
  },

  get isAdminConfigured() {
    const adminAddress = getAdminAddress();
    return adminAddress !== null;
  },
  
  get solanaNetwork() {
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  },

  get solanaRpcUrl() {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  }
} as const;