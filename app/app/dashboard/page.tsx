'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, TrendingUp, Coins, DollarSign, ExternalLink, Edit } from 'lucide-react';

export default function Dashboard() {
  const myPosts = [
    {
      id: '1',
      title: 'Building on Solana: A Guide',
      solLocked: 42.7,
      totalHype: 3420,
      earnings: 2.34,
      status: 'active',
    },
    {
      id: '2',
      title: 'DAO Governance Best Practices',
      solLocked: 21.4,
      totalHype: 1920,
      earnings: 1.12,
      status: 'active',
    },
  ];

  const myHypePositions = [
    {
      id: '1',
      postTitle: 'The Future of Solana NFTs',
      hypeAmount: 50,
      investedSOL: 1.17,
      currentValue: 1.42,
      pnl: 0.25,
      pnlPercent: 21.4,
    },
    {
      id: '2',
      postTitle: 'Web3 Gaming Takes Off',
      hypeAmount: 25,
      investedSOL: 0.78,
      currentValue: 0.89,
      pnl: 0.11,
      pnlPercent: 14.1,
    },
    {
      id: '3',
      postTitle: 'DAO Governance Best Practices',
      hypeAmount: 75,
      investedSOL: 2.99,
      currentValue: 2.84,
      pnl: -0.15,
      pnlPercent: -5.0,
    },
  ];

  const totalEarnings = myPosts.reduce((sum, post) => sum + post.earnings, 0);
  const totalLocked = myPosts.reduce((sum, post) => sum + post.solLocked, 0);
  const totalInvested = myHypePositions.reduce((sum, pos) => sum + pos.investedSOL, 0);
  const totalCurrentValue = myHypePositions.reduce((sum, pos) => sum + pos.currentValue, 0);
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 border-cyan-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow transition-all">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <DollarSign className="h-4 w-4 text-cyan-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-cyan-400">{totalEarnings.toFixed(2)} SOL</p>
              <p className="text-xs text-muted-foreground mt-2">From creator fees</p>
            </Card>

            <Card className="p-6 border-green-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow-green transition-all">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Total Locked</p>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Coins className="h-4 w-4 text-green-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-green-400">{totalLocked.toFixed(2)} SOL</p>
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

            <Card className={`p-6 border-${totalPnL >= 0 ? 'green' : 'red'}-500/30 bg-card/50 backdrop-blur-sm transition-all`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Portfolio P&L</p>
                <div className={`p-2 rounded-lg bg-${totalPnL >= 0 ? 'green' : 'red'}-500/10`}>
                  <TrendingUp className={`h-4 w-4 text-${totalPnL >= 0 ? 'green' : 'red'}-400`} />
                </div>
              </div>
              <p className={`text-3xl font-bold text-${totalPnL >= 0 ? 'green' : 'red'}-400`}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} SOL
              </p>
              <p className={`text-xs mt-2 text-${totalPnL >= 0 ? 'green' : 'red'}-400`}>
                {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(1)}%
              </p>
            </Card>
          </div>

          <Tabs defaultValue="my-posts" className="w-full">
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
                            {post.status}
                          </Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">TVL</p>
                        <p className="font-bold text-cyan-400">{post.solLocked.toFixed(2)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Hype</p>
                        <p className="font-bold text-pink-400">{post.totalHype}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Earnings</p>
                        <p className="font-bold text-green-400">{post.earnings.toFixed(2)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Actions</p>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-cyan-400 hover:text-cyan-300">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
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
                        <h3 className="text-xl font-bold mb-2">{position.postTitle}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-pink-500/50 text-pink-400">
                            <Flame className="h-3 w-3 mr-1" />
                            {position.hypeAmount} Hype
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
                        <p className="font-bold">{position.investedSOL.toFixed(2)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                        <p className="font-bold text-cyan-400">{position.currentValue.toFixed(2)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">P&L</p>
                        <p className={`font-bold text-${position.pnl >= 0 ? 'green' : 'red'}-400`}>
                          {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)} SOL
                        </p>
                      </div>
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
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
    </main>
  );
}
