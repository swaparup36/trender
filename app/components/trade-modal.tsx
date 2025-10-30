'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ArrowDownUp, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { getPostPoolAccount, hypePost, unhypePost, getUserHypeRecord } from '@/utils/smartcontractHandlers';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { cahrtDataType, PostType } from '@/types/types';
import axios from 'axios';
import CandleChart from './tradingChart';
import { usePosts } from '@/contexts/PostsContext';

interface TradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thisPost: PostType
}

export function TradeModal({ open, onOpenChange, thisPost }: TradeModalProps) {
  const walletCtx = useWallet();
  const { connection } = useConnection();
  const { refreshPosts } = usePosts();
  const [post, setPost] = useState<PostType>(thisPost);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [chartData, setChartData] = useState<cahrtDataType[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState<boolean>(false);
  const [solBalance, setSolBalance] = useState<number>(0);

  const getChartData = useCallback(async () => {
    if (!open) return;
    setIsLoadingChart(true);
    
    try {
      const response = await axios.get(`/api/trades/get-data`, {
        params: {
          postId: post.id
        }
      });

      console.log("get chart data response: ", response.data);
      if (!response.data.success) {
        console.error("Failed to fetch chart data");
        setIsLoadingChart(false);
        return;
      }

      setChartData(response.data.chartData);
    } catch (error) {
      console.error("Failed to fetch event logs: ", error);
    } finally {
      setIsLoadingChart(false);
    }
  }, [post.id, open]);

  const priceChange = useMemo(() => {
    // Calculate price change over the last interval
    if (!chartData || chartData.length < 2) return 0;
    const firstPrice = chartData[0].close;
    const lastPrice = chartData[chartData.length - 1].close;
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }, [chartData]);

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);
    if (value && !isNaN(parseFloat(value))) {
      const amount = parseFloat(value);
      if (activeTab === 'buy') {
        console.log("Amount: ", amount);
        console.log("reservedHype: ", post.reservedHype);
        const ammConstant = post.reservedHype * post.reservedSol;
        console.log("ammConstant: ", ammConstant);
        const newReservedSol = post.reservedSol + (amount*LAMPORTS_PER_SOL);
        const newReservedHype = ammConstant / newReservedSol;
        const hypeAmount = (post.reservedHype - newReservedHype)/1e6;
        console.log("Total hype amount: ", hypeAmount);
        setToAmount((hypeAmount).toFixed(6));
      } else {
        console.log("Amount: ", amount);
        console.log("reservedHype: ", post.reservedHype);
        const ammConstant = post.reservedHype * post.reservedSol;
        const newReservedHype = post.reservedHype + (amount*1e6);
        const newReservedSol = ammConstant / newReservedHype;
        const solAmount = (post.reservedSol-newReservedSol)/LAMPORTS_PER_SOL;
        setToAmount(solAmount.toFixed(9));
      }
    } else {
      setToAmount('');
    }
  };

  const handleMaxClick = () => {
    if (activeTab === 'sell' && post.userHypeBalance) {
      setFromAmount((post.userHypeBalance/1e6).toString());
      const ammConstant = post.reservedHype * post.reservedSol;
      const newReservedHype = post.reservedHype + (post.userHypeBalance);
      const newReservedSol = ammConstant / newReservedHype;
      const solAmount = (post.reservedSol-newReservedSol)/LAMPORTS_PER_SOL;
      setToAmount(solAmount.toFixed(9));
    }
  };

  const handleSwap = () => {
    const temp = fromAmount;
    setFromAmount(toAmount);
    setToAmount(temp);
  };

  const handleTrade = async (orderType: string) => {
    if (isProcessing) {
      console.log("Transaction already in progress, ignoring request");
      return;
    }
    
    setIsProcessing(true);
    setTransactionStatus('Preparing transaction...');
    
    try {
      if (orderType === 'buy') {
        // Execute buy/hypePost logic here
        const slippage = 0.005; // 0.5% slippage tolerance
        const maxAcceptablePrice = fromAmount ? parseFloat(fromAmount) * (1 + slippage) : 0;

        console.log("maxAcceptablePrice: ", maxAcceptablePrice);
        setTransactionStatus('Sending transaction...');

        const hypePostRes = await hypePost(walletCtx, new PublicKey(post.creator), post.id, parseFloat(toAmount)*1e6, maxAcceptablePrice*LAMPORTS_PER_SOL);
        console.log("Hype Post Result: ", hypePostRes);

        if (!hypePostRes.success) {
          console.error("Hype post transaction failed:", hypePostRes.error);
          setTransactionStatus(`Transaction failed: ${hypePostRes.error}`);
          return;
        }

        console.log("Hype post transaction successful");
        setTransactionStatus('Transaction confirmed! Updating data...');

        await new Promise(resolve => setTimeout(resolve, 2000));

        const hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.creator), post.id);

        if (!hypeRecord) {
          console.error("Failed to fetch updated hype record");
          setTransactionStatus('Warning: Transaction successful but failed to update balance');
          return;
        }

        console.log("Updated Hype Record: ", hypeRecord);

        const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.creator), post.id);
        if (!postPool) {
          console.log("No post pool PDA found");
          setTransactionStatus('Warning: Transaction successful but failed to update pool data');
          return;
        }

        const ammConstant = postPool.reservedHype.toNumber() * postPool.reservedSol.toNumber();
        const newReservedHype = postPool.reservedHype.toNumber() - 10000;
        const newReservedSol = ammConstant/newReservedHype;
        const price = newReservedSol - postPool.reservedSol.toNumber();

        let postDetails: PostType = {
          id: post.id,
          title: post.title,
          content: post.content,
          creator: post.creator,
          hypePrice: price,
          reservedSol: postPool.reservedSol.toNumber(),
          reservedHype: postPool.reservedHype.toNumber(),
          totalHype: postPool.totalHype.toNumber(),
          userHypeBalance: hypeRecord.amount.toNumber()
        }

        setPost(postDetails);
        
        await refreshPosts();
        setTransactionStatus('Purchase completed successfully!');
      } else if (orderType === 'sell') {
        const slippage = 0.005; // 0.5% slippage tolerance
        const minSolToReceive = parseFloat(toAmount) * (1 - slippage);
        
        setTransactionStatus('Sending transaction...');

        const unhypePostRes = await unhypePost(walletCtx, new PublicKey(post.creator), post.id, parseFloat(fromAmount)*1e6, minSolToReceive*LAMPORTS_PER_SOL);
        console.log("Unhype Post Result: ", unhypePostRes);

        if (!unhypePostRes.success) {
          console.error("Unhype post transaction failed:", unhypePostRes.error);
          setTransactionStatus(`Transaction failed: ${unhypePostRes.error}`);
          return;
        }

        console.log("Unhype post transaction successful");
        setTransactionStatus('Transaction confirmed! Updating data...');

        // Add a small delay before fetching updated data
        await new Promise(resolve => setTimeout(resolve, 2000));

        const hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.creator), post.id);

        if (!hypeRecord) {
          console.error("Failed to fetch updated hype record");
          setTransactionStatus('Warning: Transaction successful but failed to update balance');
          return;
        }

        console.log("Updated Hype Record: ", hypeRecord);

        const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.creator), post.id);
        if (!postPool) {
          console.log("No post pool PDA found");
          setTransactionStatus('Warning: Transaction successful but failed to update pool data');
          return;
        }

        const ammConstant = postPool.reservedHype.toNumber() * postPool.reservedSol.toNumber();
        const newReservedHype = postPool.reservedHype.toNumber() - 10000;
        const newReservedSol = ammConstant/newReservedHype;
        const price = newReservedSol - postPool.reservedSol.toNumber();

        let postDetails: PostType = {
          id: post.id,
          title: post.title,
          content: post.content,
          creator: post.creator,
          hypePrice: price,
          reservedSol: postPool.reservedSol.toNumber(),
          reservedHype: postPool.reservedHype.toNumber(),
          totalHype: postPool.totalHype.toNumber(),
          userHypeBalance: hypeRecord.amount.toNumber()
        }

        setPost(postDetails);

        await refreshPosts();
        setTransactionStatus('Sale completed successfully!');
      } else {
        console.error("Invalid trade type");
        setTransactionStatus('Error: Invalid trade type');
      }
    } catch (error: any) {
      console.error("Trade failed: ", error);
      setTransactionStatus(`Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setTransactionStatus('');
        onOpenChange(false);
        setFromAmount('');
        setToAmount('');
      }, 3000);
    }
  };

  const estimatedFee = fromAmount ? (parseFloat(fromAmount) * 0.01).toFixed(4) : '0.0000';
  const slippage = '0.5';

  const fetchSolBalance = useCallback(async () => {
    if (!walletCtx.publicKey) return;
    
    try {
      const balance = await connection.getBalance(walletCtx.publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error("Failed to fetch SOL balance: ", error);
    }
  }, [walletCtx.publicKey, connection]);

  useEffect(() => {
    fetchSolBalance();
  }, [fetchSolBalance, open]);

  useEffect(() => {
    if (open) {
      getChartData();
    }
    // Clear chart data when modal closes to prevent stale data
    if (!open) {
      setChartData([]);
    }
  }, [open, getChartData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-2 border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
            {post.title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4 bg-card/50 border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <TrendingUp className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">HYPE / SOL</h3>
                    <p className="text-xs text-muted-foreground font-mono">{post.creator}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-cyan-400">{(post.hypePrice).toFixed(9)}</p>
                  <Badge
                    variant="outline"
                    className={`${priceChange >= 0 ? 'border-green-500/50 text-green-400' : 'border-red-500/50 text-red-400'}`}
                  >
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-background/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">TVL</p>
                  <p className="font-bold text-sm text-cyan-400">{(post.reservedSol/1e9).toFixed(2)} SOL</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Hype</p>
                  <p className="font-bold text-sm text-pink-400">{post.totalHype/1e6}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Your Balance</p>
                  <p className="font-bold text-sm text-green-400">{post.userHypeBalance ? post.userHypeBalance/1e6 : 0} HYPE</p>
                </div>
              </div>

              <div className="relative h-80 bg-background/80 rounded-lg p-4 border border-border/30">
                <CandleChart data={chartData} isLoading={isLoadingChart} />
                <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs text-muted-foreground font-mono">
                  <span>-15m</span>
                  <span>-10m</span>
                  <span>-5m</span>
                  <span>Now</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-6 bg-card/50 border-border/50">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'buy' | 'sell')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-background/50 mb-6">
                  <TabsTrigger value="buy" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500/20 data-[state=active]:to-cyan-500/20 data-[state=active]:text-cyan-400">
                    Buy
                  </TabsTrigger>
                  <TabsTrigger value="sell" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500/20 data-[state=active]:to-red-500/20 data-[state=active]:text-pink-400">
                    Sell
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="buy" className="space-y-4 mt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">From</Label>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Balance: ~{solBalance.toFixed(4)} SOL</span>
                      </div>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={fromAmount}
                        onChange={(e) => handleFromAmountChange(e.target.value)}
                        className="pr-24 bg-background/50 border-border/50 focus:border-cyan-500/50 text-lg font-mono h-14"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600" />
                        </div>
                        <span className="font-bold text-sm">SOL</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center -my-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSwap}
                      className="rounded-full p-2 h-10 w-10 bg-background/80 border border-border/50 hover:bg-cyan-500/10 hover:border-cyan-500/50"
                    >
                      <ArrowDownUp className="h-4 w-4 text-cyan-400" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">To</Label>
                    </div>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="0.00"
                        value={toAmount}
                        readOnly
                        className="pr-24 bg-background/50 border-border/50 text-lg font-mono h-14"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-pink-500/10">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-pink-600" />
                        </div>
                        <span className="font-bold text-sm">HYPE</span>
                      </div>
                    </div>
                  </div>

                  <Card className="p-4 bg-background/30 border-border/30 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee (0.5%)</span>
                      <span className="text-pink-400">{estimatedFee} SOL</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Slippage Tolerance</span>
                      <span className="text-green-400">{slippage}%</span>
                    </div>
                  </Card>

                  <Button
                    onClick={() => handleTrade('buy')}
                    disabled={isProcessing || !fromAmount || parseFloat(fromAmount) <= 0}
                    className="w-full bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 neon-glow-green font-bold text-lg h-14"
                  >
                    {isProcessing ? transactionStatus || 'Processing...' : 'Buy Hype'}
                  </Button>

                  {transactionStatus && (
                    <div className="mt-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <p className="text-sm text-blue-400 text-center">{transactionStatus}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sell" className="space-y-4 mt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">From</Label>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Balance: {post.userHypeBalance? post.userHypeBalance/1e6 : 0}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleMaxClick}
                          className="h-5 px-2 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          Max
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={fromAmount}
                        onChange={(e) => handleFromAmountChange(e.target.value)}
                        className="pr-24 bg-background/50 border-border/50 focus:border-pink-500/50 text-lg font-mono h-14"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-pink-500/10">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-pink-600" />
                        </div>
                        <span className="font-bold text-sm">HYPE</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {['25%', '50%', '75%', '100%'].map((percent) => (
                        <Button
                          key={percent}
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const balance = post.userHypeBalance || 0;
                            const amount = (balance/1e6 * parseFloat(percent)) / 100;
                            setFromAmount(amount.toFixed(6));
                            const ammConstant = post.reservedHype * post.reservedSol;
                            const newReservedHype = post.reservedHype + (amount*1e6);
                            const newReservedSol = ammConstant / newReservedHype;
                            const solAmount = (post.reservedSol-newReservedSol)/LAMPORTS_PER_SOL;
                            setToAmount(solAmount.toFixed(9));
                          }}
                          className="flex-1 h-8 text-xs border-border/50 hover:border-pink-500/50 hover:bg-pink-500/10"
                        >
                          {percent}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center -my-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSwap}
                      className="rounded-full p-2 h-10 w-10 bg-background/80 border border-border/50 hover:bg-pink-500/10 hover:border-pink-500/50"
                    >
                      <ArrowDownUp className="h-4 w-4 text-pink-400" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">To</Label>
                      <span className="text-xs text-muted-foreground">~${toAmount ? (parseFloat(toAmount) * 100).toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="0.00"
                        value={toAmount}
                        readOnly
                        className="pr-24 bg-background/50 border-border/50 text-lg font-mono h-14"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600" />
                        </div>
                        <span className="font-bold text-sm">SOL</span>
                      </div>
                    </div>
                  </div>

                  <Card className="p-4 bg-background/30 border-border/30 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee (0.5%)</span>
                      <span className="text-pink-400">{estimatedFee} SOL</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Slippage Tolerance</span>
                      <span className="text-green-400">{slippage}%</span>
                    </div>
                  </Card>

                  <Button
                    onClick={() => handleTrade('sell')}
                    disabled={isProcessing || !fromAmount || parseFloat(fromAmount) <= 0 || parseFloat(fromAmount) > (post.userHypeBalance || 0)}
                    className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 neon-glow-pink font-bold text-lg h-14"
                  >
                    {isProcessing ? transactionStatus || 'Processing...' : 'Sell Hype'}
                  </Button>

                  {transactionStatus && (
                    <div className="mt-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <p className="text-sm text-blue-400 text-center">{transactionStatus}</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <Card className="mt-4 p-3 bg-cyan-500/5 border-cyan-500/30">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Prices are calculated using a bonding curve. Larger trades may experience higher price impact.
                  </p>
                </div>
              </Card>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
