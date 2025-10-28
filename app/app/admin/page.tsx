"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  AlertTriangle,
  DollarSign,
  Coins,
  Settings,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  getConfigAccount,
  getTreasuryBalance,
  initiateTreasury,
  withdrawTreasury,
} from "@/utils/smartcontractHandlers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { config, isAdmin as checkIsAdmin } from "@/lib/config";

export default function AdminPage() {
  const walletCtx = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminAddress, setAdminAddress] = useState<string>("");
  const [isTreasuryInitialized, setIsTreasuryInitialized] = useState(false);
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initStatus, setInitStatus] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const checkTreasuryBalance = async () => {
    try {
      const treasuryBal = await getTreasuryBalance(walletCtx);
      if (!treasuryBal) {
        setTreasuryBalance(0);
        return;
      }
      setTreasuryBalance(treasuryBal);
    } catch (error) {
      console.error("Failed to check treasury status:", error);
      setIsTreasuryInitialized(false);
    }
  };

  const checkIsTreasuryInitialized = async () => {
    try {
      const configData = await getConfigAccount(walletCtx);

      if (!configData) {
        setIsTreasuryInitialized(false);
        return;
      }

      setIsTreasuryInitialized(true);
    } catch (error) {
      console.error("Failed to check treasury status:", error);
      setIsTreasuryInitialized(false);
    }
  };

  const handleInitiateTreasury = async () => {
    if (!walletCtx.connected || !walletCtx.publicKey) {
      setInitStatus("Wallet not connected");
      return;
    }

    setIsInitializing(true);
    setInitStatus("Preparing to initialize treasury...");

    try {
      setInitStatus("Sending transaction...");

      const result = await initiateTreasury(walletCtx);

      if (result?.success) {
        setInitStatus("Treasury initialized successfully!");
        setIsTreasuryInitialized(true);

        // Clear status after 3 seconds
        setTimeout(() => {
          setInitStatus("");
        }, 3000);
      } else {
        setInitStatus(
          `Failed to initialize treasury: ${result?.error || "Unknown error"}`
        );

        // Clear error status after 5 seconds
        setTimeout(() => {
          setInitStatus("");
        }, 5000);
      }
    } catch (error: any) {
      console.error("Treasury initialization failed:", error);
      setInitStatus(`Error: ${error.message || "Unknown error occurred"}`);

      // Clear error status after 5 seconds
      setTimeout(() => {
        setInitStatus("");
      }, 5000);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleWithdrawTreasury = async () => {
    if (!walletCtx.connected || !walletCtx.publicKey) {
      setWithdrawStatus("Wallet not connected");
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setWithdrawStatus("Please enter a valid withdrawal amount");
      return;
    }

    if (!recipientAddress) {
      setWithdrawStatus("Please enter a recipient address");
      return;
    }

    let recipientPubKey: PublicKey;
    try {
      recipientPubKey = new PublicKey(recipientAddress);
    } catch (error) {
      setWithdrawStatus("Invalid recipient address");
      return;
    }

    setIsWithdrawing(true);
    setWithdrawStatus("Preparing withdrawal...");

    try {
      const amountLamports = parseFloat(withdrawAmount) * 1e9; // Convert SOL to lamports

      setWithdrawStatus("Sending transaction...");

      const result = await withdrawTreasury(
        walletCtx,
        amountLamports,
        recipientPubKey
      );

      if (result?.success) {
        setWithdrawStatus(`Successfully withdrew ${withdrawAmount} SOL!`);
        setWithdrawAmount("");

        // Clear status after 3 seconds
        setTimeout(() => {
          setWithdrawStatus("");
        }, 3000);
      } else {
        setWithdrawStatus(
          `Withdrawal failed: ${result?.error || "Unknown error"}`
        );

        // Clear error status after 5 seconds
        setTimeout(() => {
          setWithdrawStatus("");
        }, 5000);
      }
    } catch (error: any) {
      console.error("Treasury withdrawal failed:", error);
      setWithdrawStatus(`Error: ${error.message || "Unknown error occurred"}`);

      // Clear error status after 5 seconds
      setTimeout(() => {
        setWithdrawStatus("");
      }, 5000);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const validateWithdrawAmount = (value: string) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  };

  const checkAdminAccess = async () => {
    setIsLoading(true);
    setError(null);

    // Get admin address from configuration
    const envAdminAddress = config.adminAddress;

    if (!envAdminAddress) {
      setIsAdmin(false);
      setError(
        "Admin address not configured. Please set NEXT_PUBLIC_ADMIN_ADDRESS in your environment variables."
      );
      setIsLoading(false);
      return;
    }

    setAdminAddress(envAdminAddress);

    if (!walletCtx.connected || !walletCtx.publicKey) {
      setIsAdmin(false);
      setError("Please connect your wallet to access admin panel");
      setIsLoading(false);
      return;
    }

    const connectedAddress = walletCtx.publicKey.toBase58();

    if (checkIsAdmin(connectedAddress)) {
      setIsAdmin(true);
      // Initialize recipient address to admin address by default
      setRecipientAddress(connectedAddress);
    } else {
      setIsAdmin(false);
      setError(
        "Access denied. This wallet is not authorized for admin access."
      );
    }

    setIsLoading(false);
  };

  useEffect(() => {
    checkAdminAccess();
  }, [walletCtx.connected, walletCtx.publicKey]);

  useEffect(() => {
    checkIsTreasuryInitialized();
  }, [walletCtx.connected, walletCtx.publicKey]);

  useEffect(() => {
    if (isAdmin && isTreasuryInitialized) {
      checkTreasuryBalance();
    }
  }, [isTreasuryInitialized, isAdmin]);

  if (isLoading) {
    return (
      <main className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="p-8 border-cyan-500/30 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
                <p className="text-lg">Checking admin access...</p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="p-8 border-red-500/30 bg-card/50 backdrop-blur-sm max-w-md">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 rounded-full bg-red-500/10">
                    <Shield className="h-8 w-8 text-red-400" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-red-400">
                  Access Denied
                </h1>
                <p className="text-muted-foreground">
                  {error ||
                    "You do not have permission to access the admin panel."}
                </p>
                {!walletCtx.connected && (
                  <p className="text-sm text-muted-foreground">
                    Please connect your wallet to continue.
                  </p>
                )}
                {walletCtx.connected && (
                  <div className="text-xs text-muted-foreground break-all">
                    <p>Connected: {walletCtx.publicKey?.toBase58()}</p>
                    <p>Required: {adminAddress}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Shield className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
                Admin Panel
              </h1>
              <p className="text-muted-foreground">
                Manage treasury and platform settings
              </p>
            </div>
          </div>

          {/* Admin Status */}
          <Alert className="border-green-500/30 bg-green-500/5">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-400">
              Admin access granted for: {walletCtx.publicKey?.toBase58()}
            </AlertDescription>
          </Alert>

          {/* Treasury Balance Display */}
          {isTreasuryInitialized && (
            <Card className="p-6 border-purple-500/30 bg-card/50 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Coins className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Treasury Balance</h2>
                    <p className="text-sm text-muted-foreground">
                      Current balance in the platform treasury
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-background/30">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Available Balance
                    </p>
                    <p className="text-2xl font-bold text-purple-400">
                      {(treasuryBalance/LAMPORTS_PER_SOL).toFixed(9)} SOL
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ≈ {(treasuryBalance).toLocaleString()} lamports
                    </p>
                  </div>

                  <Button
                    onClick={checkTreasuryBalance}
                    variant="outline"
                    size="sm"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    Refresh Balance
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Treasury Management */}
          <div className="grid gap-6">
            {/* Treasury Initialization */}
            <Card className="p-6 border-cyan-500/30 bg-card/50 backdrop-blur-sm">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <Settings className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      Treasury Initialization
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Initialize the platform treasury to enable fee collection
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Treasury Status</p>
                    <Badge
                      variant="outline"
                      className={`${
                        isTreasuryInitialized
                          ? "border-green-500/50 text-green-400"
                          : "border-yellow-500/50 text-yellow-400"
                      }`}
                    >
                      {isTreasuryInitialized
                        ? "Initialized"
                        : "Not Initialized"}
                    </Badge>
                  </div>

                  <Button
                    onClick={handleInitiateTreasury}
                    disabled={isInitializing || isTreasuryInitialized}
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 neon-glow font-bold"
                  >
                    {isInitializing ? "Initializing..." : "Initialize Treasury"}
                  </Button>
                </div>

                {initStatus && (
                  <Alert
                    className={`${
                      initStatus.includes("success")
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-red-500/30 bg-red-500/5"
                    }`}
                  >
                    {initStatus.includes("success") ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <AlertDescription
                      className={
                        initStatus.includes("success")
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {initStatus}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </Card>

            {/* Treasury Withdrawal */}
            <Card className="p-6 border-pink-500/30 bg-card/50 backdrop-blur-sm">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-pink-500/10">
                    <DollarSign className="h-5 w-5 text-pink-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Treasury Withdrawal</h2>
                    <p className="text-sm text-muted-foreground">
                      Withdraw SOL from the platform treasury
                    </p>
                  </div>
                </div>

                <Alert className="border-yellow-500/30 bg-yellow-500/5">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <AlertDescription className="text-yellow-400">
                    Only withdraw what is necessary. Treasury funds are used for
                    platform operations.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="withdrawAmount">Amount (SOL)</Label>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      step="0.000000001"
                      min="0"
                      placeholder="0.000000000"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipientAddress">Recipient Address</Label>
                    <Input
                      id="recipientAddress"
                      placeholder="Enter Solana wallet address"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="bg-background/50 font-mono text-sm"
                    />
                  </div>

                  <Button
                    onClick={handleWithdrawTreasury}
                    disabled={
                      isWithdrawing ||
                      !validateWithdrawAmount(withdrawAmount) ||
                      !recipientAddress
                    }
                    className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 neon-glow-pink font-bold"
                  >
                    <Coins className="h-4 w-4 mr-2" />
                    {isWithdrawing ? "Processing..." : "Withdraw from Treasury"}
                  </Button>
                </div>

                {withdrawStatus && (
                  <Alert
                    className={`${
                      withdrawStatus.includes("Success")
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-red-500/30 bg-red-500/5"
                    }`}
                  >
                    {withdrawStatus.includes("Success") ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <AlertDescription
                      className={
                        withdrawStatus.includes("Success")
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {withdrawStatus}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
