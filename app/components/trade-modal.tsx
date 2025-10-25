'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ArrowDownUp, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { getPostPoolAccount, getUserHypeRecord, hypePost, unhypePost } from '@/utils/smartcontractHandlers';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { cahrtDataType, PostType } from '@/types/types';
import axios from 'axios';
import CandleChart from './tradingChart';

interface TradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thisPost: PostType
}

export function TradeModal({ open, onOpenChange, thisPost }: TradeModalProps) {
  const walletCtx = useWallet();
  const { connection } = useConnection();
  const [post, setPost] = useState<PostType>(thisPost);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chartData, setChartData] = useState<cahrtDataType[]>([]);
  const [solBalance, setSolBalance] = useState<number>(0);

  const getChartData = async () => {
    try {
      const response = await axios.get(`/api/trades/get-data`, {
        params: {
          postId: post.id
        }
      });
      if (!response.data.success) {
        console.error("Failed to fetch chart data");
        return;
      }

      console.log("chart Data: ", chartData);

      setChartData(response.data.eventLogs);
    } catch (error) {
      console.error("Failed to fetch event logs: ", error);
    }
  }

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
        console.log("Hype price: ", post.hypePrice/1e6);
        console.log("Amount: ", amount);
        const hypeAmount = amount / (post.hypePrice/1e6);
        console.log("Total hype amount: ", hypeAmount);
        setToAmount((hypeAmount).toFixed(6));
      } else {
        const solAmount = amount * post.hypePrice;
        setToAmount(solAmount.toFixed(4));
      }
    } else {
      setToAmount('');
    }
  };

  const handleMaxClick = () => {
    if (activeTab === 'sell' && post.userHypeBalance) {
      setFromAmount(post.userHypeBalance.toString());
      setToAmount((post.userHypeBalance * post.hypePrice).toFixed(4));
    }
  };

  const handleSwap = () => {
    const temp = fromAmount;
    setFromAmount(toAmount);
    setToAmount(temp);
  };

  const handleTrade = async (orderType: string) => {
    setIsProcessing(true);
    
    try {
      if (orderType === 'buy') {
        // Execute buy/hypePost logic here
        const slippage = 0.005; // 0.5% slippage tolerance
        const maxAcceptablePrice = fromAmount ? parseFloat(fromAmount) * (1 + slippage) : 0;

        const hypePostRes = await hypePost(walletCtx, new PublicKey(post.creator), post.id, parseFloat(toAmount), maxAcceptablePrice);
        console.log("Hype Post Result: ", hypePostRes);

        if (!hypePostRes) {
          console.error("Hype post transaction failed");
          return;
        }

        console.log("Hype post transaction successful");

        const hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.creator), post.id);

        if (!hypeRecord) {
          console.error("Failed to fetch updated hype record");
          return;
        }

        console.log("Updated Hype Record: ", hypeRecord);

        const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.creator), post.id);
        if (!postPool) {
          console.log("No post pool PDA found");
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
          totalHype: postPool.totalHype.toNumber(),
          userHypeBalance: hypeRecord.amount.toNumber()
        }

        setPost(postDetails);
      } else if (orderType === 'sell') {
        // Execute sell/unhypePost logic here
        const slippage = 0.005; // 0.5% slippage tolerance
        const minSolToReceive = parseFloat(toAmount) * (1 - slippage);
        
        const unhypePostRes = await unhypePost(walletCtx, new PublicKey(post.creator), post.id, parseFloat(toAmount), minSolToReceive);
        console.log("Unhype Post Result: ", unhypePostRes);

        if (!unhypePostRes) {
          console.error("Unhype post transaction failed");
          return;
        }

        console.log("Unhype post transaction successful");

        const hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.creator), post.id);

        if (!hypeRecord) {
          console.error("Failed to fetch updated hype record");
          return;
        }

        console.log("Updated Hype Record: ", hypeRecord);

        const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.creator), post.id);
        if (!postPool) {
          console.log("No post pool PDA found");
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
          totalHype: postPool.totalHype.toNumber(),
          userHypeBalance: hypeRecord.amount.toNumber()
        }

        setPost(postDetails);
      } else {
        console.error("Invalid trade type");
      }
    } catch (error) {
      console.error("Trade failed: ", error);
    } finally {
      setIsProcessing(false);
      onOpenChange(false);
      setFromAmount('');
      setToAmount('');
    }
  };

  // Calculate estimated fee and slippage --> fee is 1% of fromAmount
  const estimatedFee = fromAmount ? (parseFloat(fromAmount) * 0.01).toFixed(4) : '0.0000';
  const slippage = '0.5';

  const fetchSolBalance = async () => {
    if (!walletCtx.publicKey) return;
    
    try {
      const balance = await connection.getBalance(walletCtx.publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error("Failed to fetch SOL balance: ", error);
    }
  };

  useEffect(() => {
    fetchSolBalance();
  }, [walletCtx.publicKey, connection, open]);

  useEffect(() => {
    getChartData();
  }, [walletCtx.connected, open]);

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
                  <p className="text-2xl font-bold text-cyan-400">{(post.hypePrice/1e6).toFixed(9)}</p>
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
                <CandleChart data={chartData} />
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
                    {isProcessing ? 'Processing...' : 'Buy Hype'}
                  </Button>
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
                            const amount = (balance * parseFloat(percent)) / 100;
                            setFromAmount(amount.toFixed(2));
                            setToAmount((amount * post.hypePrice).toFixed(4));
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
                    {isProcessing ? 'Processing...' : 'Sell Hype'}
                  </Button>
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
