'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, TrendingUp, Coins, DollarSign, ExternalLink, Edit, Gift } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PostType, tradeOrdersType } from '@/types/types';
import axios from 'axios';
import { getPostPoolAccount, getUserHypeRecord, creatorReleaseHype } from '@/utils/smartcontractHandlers';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TradeModal } from '@/components/trade-modal';

interface PostTypeOwner extends PostType {
  creatorHypeBalance: number;
}

interface HypePosition extends PostType {
  tradeOrders: tradeOrdersType[];
  pnl: number;
  pnlPercent: number;
  investedSOL: number;
  currentValue: number;
}

export default function Dashboard() {
  const walletCtx = useWallet();

  const [myPosts, setMyPosts] = useState<PostTypeOwner[]>([]);
  const [myHypePositions, setMyHypePositions] = useState<HypePosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-posts' | 'my-hype'>('my-posts');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostType | null>(null);
  const [isReleasing, setIsReleasing] = useState<{ [key: string]: boolean }>({});
  const [releaseStatus, setReleaseStatus] = useState<{ [key: string]: string }>({});

  const getAllPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!walletCtx.connected) {
      console.error("Wallet not connected");
      setError("Please connect your wallet to view your posts");
      setIsLoading(false);
      return;
    }
    
    try {
      const getAllPostsRes = await axios.get('/api/post/get-by-user', {
        params: {
          userPubKey: walletCtx.publicKey?.toBase58() || ''
        }
      });

      if (getAllPostsRes.status !== 200) {
        console.error("Error getting all posts: ", getAllPostsRes.data.message);
        setError(getAllPostsRes.data.message || "Failed to fetch posts");
        return;
      }

      let allPosts: PostTypeOwner[] = [];
      for (let post of getAllPostsRes.data.allPosts) {
        const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.userPubKey), post.id);
        if (!postPool) {
          console.log("No post pool PDA found");
          continue;
        }

        let hypeRecord = null;
        try {
          hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.userPubKey), post.id);
        } catch (error) {
          // User don't have a hype record for this post
        }

        console.log("reservedHype: ", postPool.reservedHype.toNumber());
        console.log("reservedSol: ", postPool.reservedSol.toNumber());

        const ammConstant = postPool.reservedHype.toNumber() * postPool.reservedSol.toNumber();
        const newReservedHype = postPool.reservedHype.toNumber() - 1000000;
        const newReservedSol = ammConstant/newReservedHype;
        const price = (newReservedSol - postPool.reservedSol.toNumber());

        console.log("postPool: ", postPool);

        let postDetails: PostTypeOwner = {
          id: post.id,
          title: post.title,
          content: post.content,
          creator: post.userPubKey,
          hypePrice: price/1e9,
          reservedSol: postPool.reservedSol.toNumber(),
          reservedHype: postPool.reservedHype.toNumber(),
          totalHype: postPool.totalHype.toNumber(),
          creatorHypeBalance: postPool.creatorHypeBalance.toNumber(),
          userHypeBalance: hypeRecord ? hypeRecord.amount.toNumber() : 0
        }

        console.log("post to push: ", postDetails);

        allPosts.push(postDetails);
      }

      setMyPosts(allPosts);
    } catch (error) {
      console.error("Unable to get all the posts: ", error);
      setError("Failed to fetch posts");
    } finally {
      setIsLoading(false);
    }
  }, [walletCtx]);

  const getAllPositionsUserHyped = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!walletCtx.connected) {
      console.error("Wallet not connected");
      setError("Please connect your wallet to view your posts");
      setIsLoading(false);
      return;
    }
    
    try {
      const getAllPostsRes = await axios.get('/api/post/get-by-user', {
        params: {
          userPubKey: walletCtx.publicKey?.toBase58() || ''
        }
      });

      if (getAllPostsRes.status !== 200) {
        console.error("Error getting all posts: ", getAllPostsRes.data.message);
        setError(getAllPostsRes.data.message || "Failed to fetch posts");
        return;
      }

      let allPosts: HypePosition[] = [];
      for (let post of getAllPostsRes.data.allPosts) {
        const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.userPubKey), post.id);
        if (!postPool) {
          console.log("No post pool PDA found");
          continue;
        }

        const hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.userPubKey), post.id);
        if (!hypeRecord || hypeRecord.amount.toNumber() === 0) {
          continue;
        }

        console.log("reservedHype: ", postPool.reservedHype.toNumber());
        console.log("reservedSol: ", postPool.reservedSol.toNumber());

        const ammConstant = postPool.reservedHype.toNumber() * postPool.reservedSol.toNumber();
        const newReservedHype = postPool.reservedHype.toNumber() - 1000000;
        const newReservedSol = ammConstant/newReservedHype;
        const price = (newReservedSol - postPool.reservedSol.toNumber());

        console.log("postPool: ", postPool);

        // Get all trade orders for this post and user - 'buy'/'HYPE' orders only
        const tradeOrdersRes = await axios.get('/api/trades/get-trade-orders', {
          params: {
            postId: post.id,
            userPubKey: walletCtx.publicKey?.toBase58() || '',
            eventType: 'HYPE'
          }
        });

        if (tradeOrdersRes.status !== 200) {
          console.error("Error getting trade orders: ", tradeOrdersRes.data.message);
          setError(tradeOrdersRes.data.message || "Failed to fetch trade orders");
          return;
        }

        console.log("trade orders for this post: ", tradeOrdersRes.data.tradeData);
        const tradeOrders: tradeOrdersType[] = tradeOrdersRes.data.tradeData;

        console.log("investedSOL: ", tradeOrders.reduce((sum, order) => sum + order.totalCost, 0));
        console.log("currentValue: ", price/1e9 * (hypeRecord ? hypeRecord.amount.toNumber()/1e6 : 0));
        console.log("pnl: ", (price/1e9 * (hypeRecord ? hypeRecord.amount.toNumber()/1e6 : 0)) - (tradeOrders.reduce((sum, order) => sum + order.totalCost, 0)));
        console.log("pnlPercent: ", (((price/1e9 * (hypeRecord ? hypeRecord.amount.toNumber()/1e6 : 0)) - (tradeOrders.reduce((sum, order) => sum + order.totalCost, 0))) / (tradeOrders.reduce((sum, order) => sum + order.totalCost, 0))) * 100);

        let postDetails: HypePosition = {
          id: post.id,
          title: post.title,
          content: post.content,
          creator: post.userPubKey,
          hypePrice: price/1e9,
          reservedSol: postPool.reservedSol.toNumber(),
          reservedHype: postPool.reservedHype.toNumber(),
          totalHype: postPool.totalHype.toNumber(),
          userHypeBalance: hypeRecord ? hypeRecord.amount.toNumber() : 0,
          tradeOrders: tradeOrders,
          currentValue: price/1e9 * (hypeRecord ? hypeRecord.amount.toNumber()/1e6 : 0),
          investedSOL: tradeOrders.reduce((sum, order) => sum + order.totalCost, 0),
          pnl: (price/1e9 * (hypeRecord ? hypeRecord.amount.toNumber()/1e6 : 0)) - (tradeOrders.reduce((sum, order) => sum + order.totalCost, 0)),
          pnlPercent: (((price/1e9 * (hypeRecord ? hypeRecord.amount.toNumber()/1e6 : 0)) - (tradeOrders.reduce((sum, order) => sum + order.totalCost, 0))) / (tradeOrders.reduce((sum, order) => sum + order.totalCost, 0))) * 100
        }

        console.log("post to push that user hyped: ", postDetails);

        allPosts.push(postDetails);
      }

      setMyHypePositions(allPosts);
    } catch (error) {
      console.error("Unable to get all the posts: ", error);
      setError("Failed to fetch posts");
    } finally {
      setIsLoading(false);
    }
  }, [walletCtx]);

  const totalLiquidity = myPosts.reduce((sum, post) => sum + post.reservedSol, 0);
  const totalLockedHype = myPosts.reduce((sum, post) => sum + post.reservedHype, 0);
  const totalWonerHypeBalance = myPosts.reduce((sum, post) => sum + post.creatorHypeBalance, 0);
  const totalInvested = myHypePositions.reduce((sum, pos) => sum + pos.investedSOL, 0);
  const totalCurrentValue = myHypePositions.reduce((sum, pos) => sum + pos.currentValue, 0);
  const totalPnl = totalCurrentValue - totalInvested;
  const totalPnlPercent = (totalPnl / totalInvested) * 100;
  
  const totalOwnerHypeBalanceValueSOL = myPosts.reduce((sum, post) => {
    const ammConstant = post.reservedHype * post.reservedSol;
    const newHypeBalance = post.reservedHype + post.creatorHypeBalance;
    const newReservedSol = ammConstant / newHypeBalance;
    const valueSOL = post.reservedSol - newReservedSol;
    return sum + valueSOL;
  }, 0);

  const handleUnhypeClick = (position: HypePosition) => {
    // Convert HypePosition to PostType for the trade modal
    const postForModal: PostType = {
      id: position.id,
      title: position.title,
      content: position.content,
      creator: position.creator,
      hypePrice: position.hypePrice,
      reservedSol: position.reservedSol,
      reservedHype: position.reservedHype,
      totalHype: position.totalHype,
      userHypeBalance: position.userHypeBalance
    };
    
    setSelectedPost(postForModal);
    setIsTradeModalOpen(true);
  };

  const handleReleaseHype = async (post: PostTypeOwner) => {
    if (!walletCtx.connected || !walletCtx.publicKey) {
      console.error("Wallet not connected");
      return;
    }

    if (post.creatorHypeBalance <= 0) {
      console.error("No hype balance to release");
      return;
    }

    const postKey = `${post.creator}-${post.id}`;
    
    // Prevent multiple simultaneous transactions for the same post
    if (isReleasing[postKey]) {
      console.log("Release already in progress for this post, ignoring request");
      return;
    }

    setIsReleasing(prev => ({ ...prev, [postKey]: true }));
    setReleaseStatus(prev => ({ ...prev, [postKey]: 'Preparing transaction...' }));

    try {
      console.log("Releasing hype for post:", post.id);
      console.log("Amount to release:", post.creatorHypeBalance);

      setReleaseStatus(prev => ({ ...prev, [postKey]: 'Sending transaction...' }));

      const result = await creatorReleaseHype(
        walletCtx, 
        new PublicKey(post.creator), 
        post.id, 
        post.creatorHypeBalance
      );

      if (!result?.success) {
        console.error("Release hype transaction failed:", result?.error);
        setReleaseStatus(prev => ({ 
          ...prev, 
          [postKey]: `Transaction failed: ${result?.error || 'Unknown error'}` 
        }));
        return;
      }

      console.log("Release hype transaction successful");
      setReleaseStatus(prev => ({ ...prev, [postKey]: 'Transaction confirmed! Updating data...' }));

      // Add a small delay before fetching updated data
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh the posts data
      await getAllPosts();
      
      setReleaseStatus(prev => ({ ...prev, [postKey]: 'Hype released successfully!' }));
    } catch (error: any) {
      console.error("Release hype failed: ", error);
      setReleaseStatus(prev => ({ 
        ...prev, 
        [postKey]: `Error: ${error.message || 'Unknown error occurred'}` 
      }));
    } finally {
      // Keep the status visible for a few seconds before clearing
      setTimeout(() => {
        setIsReleasing(prev => ({ ...prev, [postKey]: false }));
        setReleaseStatus(prev => ({ ...prev, [postKey]: '' }));
      }, 3000);
    }
  };

  useEffect(() => {
    getAllPosts();
  }, [getAllPosts]);

  useEffect(() => {
    getAllPositionsUserHyped();
  }, [getAllPositionsUserHyped]);

  return (
    <main className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-green-400 to-pink-400 bg-clip-text text-transparent mb-2">
              Your Dashboard
            </h1>
            <p className="text-muted-foreground">Track your posts, earnings, and hype positions</p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeTab === 'my-posts' ? (
              <>
                <Card className="p-6 border-cyan-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Total Reserved SOL</p>
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <DollarSign className="h-4 w-4 text-cyan-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-cyan-400">{(totalLiquidity/1e9).toFixed(9)} SOL</p>
                  <p className="text-xs text-muted-foreground mt-2">Total SOL reserved on your all posts</p>
                </Card>

                <Card className="p-6 border-green-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow-green transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Total Locked</p>
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Coins className="h-4 w-4 text-green-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-400">{(totalLockedHype/1e6).toFixed(6)} HYPE</p>
                  <p className="text-xs text-muted-foreground mt-2">In your posts</p>
                </Card>

                <Card className="p-6 border-pink-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow-pink transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Active Posts</p>
                    <div className="p-2 rounded-lg bg-pink-500/10">
                      <Flame className="h-4 w-4 text-pink-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-pink-400">{myPosts.length}</p>
                  <p className="text-xs text-muted-foreground mt-2">Live on platform</p>
                </Card>

                <Card className={`p-6 border-green-500/30 bg-card/50 backdrop-blur-sm transition-all`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Owner hype bonus balance</p>
                    <div className={`p-2 rounded-lg bg-green-500/10`}>
                      <TrendingUp className={`h-4 w-4 text-green-400`} />
                    </div>
                  </div>
                  <p className={`text-3xl font-bold text-green-400`}>
                    {(totalWonerHypeBalance/1e6).toFixed(6)} HYPE
                  </p>
                  <p className={`text-xs mt-2 text-green-400`}>
                    {(totalOwnerHypeBalanceValueSOL/1e9).toFixed(9)} SOL
                  </p>
                </Card>
              </>
            ) : (
              <>
                <Card className="p-6 border-cyan-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Total Invested</p>
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <DollarSign className="h-4 w-4 text-cyan-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-cyan-400">{totalInvested.toFixed(9)} SOL</p>
                  <p className="text-xs text-muted-foreground mt-2">Total amount invested in hype</p>
                </Card>

                <Card className="p-6 border-green-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow-green transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Current Value</p>
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Coins className="h-4 w-4 text-green-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-400">{totalCurrentValue.toFixed(9)} SOL</p>
                  <p className="text-xs text-muted-foreground mt-2">Current portfolio value</p>
                </Card>

                <Card className="p-6 border-pink-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow-pink transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Active Positions</p>
                    <div className="p-2 rounded-lg bg-pink-500/10">
                      <Flame className="h-4 w-4 text-pink-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-pink-400">{myHypePositions.length}</p>
                  <p className="text-xs text-muted-foreground mt-2">Currently hyped posts</p>
                </Card>

                <Card className={`p-6 border-${totalPnl >= 0 ? 'green' : 'red'}-500/30 bg-card/50 backdrop-blur-sm transition-all`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">P&L</p>
                    <div className={`p-2 rounded-lg bg-${totalPnl >= 0 ? 'green' : 'red'}-500/10`}>
                      <TrendingUp className={`h-4 w-4 text-${totalPnl >= 0 ? 'green' : 'red'}-400`} />
                    </div>
                  </div>
                  <p className={`text-3xl font-bold text-${totalPnl >= 0 ? 'green' : 'red'}-400`}>
                    {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(9)} SOL
                  </p>
                  <p className={`text-xs mt-2 text-${totalPnl >= 0 ? 'green' : 'red'}-400`}>
                    {totalPnl >= 0 ? '+' : ''}{isNaN(totalPnlPercent) ? '0.0' : totalPnlPercent.toFixed(1)}%
                  </p>
                </Card>
              </>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'my-posts' | 'my-hype')} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-card/50">
              <TabsTrigger value="my-posts">My Posts</TabsTrigger>
              <TabsTrigger value="my-hype">My Hype</TabsTrigger>
            </TabsList>

            <TabsContent value="my-posts" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Your Posts</h2>
                <Button className="bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 neon-glow font-bold">
                  Create New Post
                </Button>
              </div>

              <div className="space-y-4">
                {myPosts.map((post) => (
                  <Card key={post.id} className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-cyan-500/50 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{post.title}</h3>
                          <Badge variant="outline" className="border-green-500/50 text-green-400">
                            {(post.totalHype/1e6).toFixed(6)} HYPE
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">TVL</p>
                        <p className="font-bold text-cyan-400">{(post.reservedSol/1e9).toFixed(9)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Hype</p>
                        <p className="font-bold text-pink-400">{(post.totalHype/1e6).toFixed(6)} HYPE</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Holdings</p>
                        <p className="font-bold text-green-400">{post.userHypeBalance ? (post.userHypeBalance/1e6).toFixed(6) : 0} HYPE</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Price</p>
                        <p className="font-bold text-green-400">{post.hypePrice.toFixed(9)} SOL/HYPE</p>
                      </div>
                    </div>

                    {/* Creator Actions */}
                    <div className="pt-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Creator Hype Balance</p>
                        <p className="font-bold text-green-400">{(post.creatorHypeBalance/1e6).toFixed(6)} HYPE</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {post.creatorHypeBalance > 0 && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleReleaseHype(post)}
                              disabled={isReleasing[`${post.creator}-${post.id}`] || post.creatorHypeBalance <= 0}
                              className="bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 neon-glow-green font-bold flex items-center gap-2"
                            >
                              <Gift className="h-4 w-4" />
                              {isReleasing[`${post.creator}-${post.id}`] ? 'Releasing...' : 'Release Hype'}
                            </Button>
                            {releaseStatus[`${post.creator}-${post.id}`] && (
                              <div className="text-xs text-center max-w-32">
                                <p className={`${releaseStatus[`${post.creator}-${post.id}`].includes('failed') || releaseStatus[`${post.creator}-${post.id}`].includes('Error') ? 'text-red-400' : 'text-blue-400'}`}>
                                  {releaseStatus[`${post.creator}-${post.id}`]}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="my-hype" className="space-y-4 mt-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Your Hype Positions</h2>
                <p className="text-sm text-muted-foreground">Posts {"you've"} hyped and their performance</p>
              </div>

              <div className="space-y-4">
                {myHypePositions.map((position) => (
                  <Card key={position.id} className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-pink-500/50 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">{position.title}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-pink-500/50 text-pink-400">
                            <Flame className="h-3 w-3 mr-1" />
                            {position.userHypeBalance ? (position.userHypeBalance/1e6).toFixed(6) : 0} Hype
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`border-${position.pnl >= 0 ? 'green' : 'red'}-500/50 text-${position.pnl >= 0 ? 'green' : 'red'}-400`}
                          >
                            {position.pnl >= 0 ? '+' : ''}{position.pnlPercent.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Invested</p>
                        <p className="font-bold">{position.investedSOL.toFixed(9)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                        <p className="font-bold text-cyan-400">{position.currentValue.toFixed(9)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">P&L</p>
                        <p className={`font-bold text-${position.pnl >= 0 ? 'green' : 'red'}-400`}>
                          {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(9)} SOL
                        </p>
                      </div>
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnhypeClick(position)}
                          className="w-full border-pink-500/50 hover:bg-pink-500/10 hover:border-pink-500"
                        >
                          Unhype
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Trade Modal */}
      {selectedPost && (
        <TradeModal
          open={isTradeModalOpen}
          onOpenChange={setIsTradeModalOpen}
          thisPost={selectedPost}
        />
      )}
    </main>
  );
}
