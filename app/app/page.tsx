'use client';

import { StatsBar } from '@/components/stats-bar';
import { PostCard } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Flame } from 'lucide-react';
import { useState } from 'react';
import { usePosts } from '@/contexts/PostsContext';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Home() {
  const walletContext = useWallet();
  const router = useRouter();
  const { allPosts, isLoading, error } = usePosts();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = allPosts.filter(
    post =>
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalVolume = allPosts.reduce((sum, post) => sum + post.reservedSol, 0);
  const totalHype = allPosts.reduce((sum, post) => sum + post.totalHype, 0);

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-4 py-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4">
            <Flame className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-400">Currently On Devenet</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-green-400 bg-clip-text text-transparent leading-tight">
            Hype What You Love
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Support creators through AMM-style bonding curves. Hype the posts you like, Unhype what you do not like and earn rewards.
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 neon-glow font-bold text-lg px-8"
            >
              Start Hyping
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-cyan-500/50 hover:bg-cyan-500/10 font-bold text-lg px-8"
              onClick={() => router.push('/create')}
            >
              Create Post
            </Button>
          </div>
        </div>

        <StatsBar
          totalPosts={allPosts.length}
          totalVolume={totalVolume}
          totalHype={totalHype}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">All Posts</h2>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/50 border-border/50 focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">Loading posts...</p>
              </div>
            ) : error ? (
              <div className="col-span-full text-center py-12">
                <p className="text-red-400">Error: {error}</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <PostCard key={post.id} {...post} />
              ))
            )}
          </div>

          {!isLoading && !error && filteredPosts.length === 0 && walletContext.connected && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts found matching your search.</p>
            </div>
          )}

          {
            !isLoading && !error && allPosts.length === 0 && !walletContext.connected && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No posts available. Connect your wallet to create the first post!</p>
              </div>
            )
          }
        </div>
      </div>
    </main>
  );
}
