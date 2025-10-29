'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Eye, DollarSign } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { PostType } from '@/types/types';
import axios from 'axios';
import { getPostPoolAccount, getUserHypeRecord } from '@/utils/smartcontractHandlers';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TradeModal } from '@/components/trade-modal';
import { ContentWithLinks } from '@/components/content-with-links';

export default function TrendingPage() {
  const walletCtx = useWallet();

  const [trendingPosts, setTrendingPosts] = useState<PostType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostType | null>(null);

  const getTrendingPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const getTrendingPostsRes = await axios.get('/api/post/get-all');

      if (getTrendingPostsRes.status !== 200) {
        console.error("Error getting trending posts: ", getTrendingPostsRes.data.message);
        setError(getTrendingPostsRes.data.message || "Failed to fetch trending posts");
        return;
      }

      let postsWithHypeData: PostType[] = [];
      for (let post of getTrendingPostsRes.data.allPosts) {
        try {
          const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.userPubKey), post.id);
          if (!postPool) {
            console.log("No post pool PDA found for post", post.id);
            continue;
          }

          let hypeRecord = null;
          try {
            if (walletCtx.connected && walletCtx.publicKey) {
              hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.userPubKey), post.id);
            }
          } catch (error) {
            // User do not have a hype record for this post
          }

          console.log("reservedHype: ", postPool.reservedHype.toNumber());
          console.log("reservedSol: ", postPool.reservedSol.toNumber());

          const ammConstant = postPool.reservedHype.toNumber() * postPool.reservedSol.toNumber();
          const newReservedHype = postPool.reservedHype.toNumber() - 1000000;
          const newReservedSol = ammConstant/newReservedHype;
          const price = (newReservedSol - postPool.reservedSol.toNumber());

          let postDetails: PostType = {
            id: post.id,
            title: post.title,
            content: post.content,
            creator: post.userPubKey,
            imageUrl: post.imageUrl || undefined,
            hypePrice: price/1e9,
            reservedSol: postPool.reservedSol.toNumber(),
            reservedHype: postPool.reservedHype.toNumber(),
            totalHype: postPool.totalHype.toNumber(),
            userHypeBalance: hypeRecord ? hypeRecord.amount.toNumber() : 0,
          }

          console.log("trending post to push: ", postDetails);

          postsWithHypeData.push(postDetails);
        } catch (error) {
          console.error("Error processing post", post.id, ":", error);
        }
      }

      const sortedPosts = postsWithHypeData
        .sort((a, b) => b.totalHype - a.totalHype)
        .slice(0, 20);

      setTrendingPosts(sortedPosts);
    } catch (error) {
      console.error("Unable to get trending posts: ", error);
      setError("Failed to fetch trending posts");
    } finally {
      setIsLoading(false);
    }
  }, [walletCtx]);

  const handleHypeClick = (post: PostType) => {
    setSelectedPost(post);
    setIsTradeModalOpen(true);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    getTrendingPosts();
  }, [getTrendingPosts]);

  return (
    <main className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              🔥 Trending Posts
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover the hottest content with the most total hype! These are the top 20 posts generating the most excitement on Trender.
            </p>
          </div>

          {/* Stats Banner */}
          {!isLoading && trendingPosts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 border-pink-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow-pink transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Top Post Hype</p>
                  <div className="p-2 rounded-lg bg-pink-500/10">
                    <Flame className="h-4 w-4 text-pink-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-pink-400">
                  {(trendingPosts[0]?.totalHype / 1e6)?.toFixed(2)} HYPE
                </p>
                <p className="text-xs text-muted-foreground mt-2">Most hyped post</p>
              </Card>

              <Card className="p-6 border-cyan-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Total TVL</p>
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <DollarSign className="h-4 w-4 text-cyan-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-cyan-400">
                  {(trendingPosts.reduce((sum, post) => sum + post.reservedSol, 0) / 1e9).toFixed(3)} SOL
                </p>
                <p className="text-xs text-muted-foreground mt-2">Combined liquidity</p>
              </Card>

              <Card className="p-6 border-green-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow-green transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">Total Hype</p>
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-400">
                  {(trendingPosts.reduce((sum, post) => sum + post.totalHype, 0) / 1e6).toFixed(2)} HYPE
                </p>
                <p className="text-xs text-muted-foreground mt-2">Across all trending posts</p>
              </Card>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400 mx-auto"></div>
                <p className="text-muted-foreground">Loading trending posts...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <Card className="p-6 border-red-500/30 bg-card/50 backdrop-blur-sm max-w-md mx-auto">
                <p className="text-red-400 font-medium mb-2">Error Loading Posts</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button 
                  onClick={getTrendingPosts}
                  variant="outline"
                  className="border-red-500/50 hover:bg-red-500/10"
                >
                  Try Again
                </Button>
              </Card>
            </div>
          )}

          {/* Trending Posts List */}
          {!isLoading && !error && (
            <div className="space-y-6">
              {trendingPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Card className="p-8 border-border/50 bg-card/50 backdrop-blur-sm max-w-md mx-auto">
                    <div className="space-y-4">
                      <div className="p-4 rounded-full bg-muted/50 w-16 h-16 mx-auto flex items-center justify-center">
                        <Flame className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">No Trending Posts</h3>
                        <p className="text-sm text-muted-foreground">
                          No posts found with hype data. Create some posts and start the hype!
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  {trendingPosts.map((post, index) => (
                    <Card 
                      key={post.id} 
                      className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-pink-500/50 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        {/* Ranking */}
                        <div className="flex-shrink-0">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                            ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' : 
                              index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                              index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                              'bg-gradient-to-br from-purple-500 to-pink-500 text-white'}
                          `}>
                            {index + 1}
                          </div>
                        </div>

                        {/* Post Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold mb-2 text-foreground">{post.title}</h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                <span>by {formatAddress(post.creator)}</span>
                                <Badge variant="outline" className="border-pink-500/50 text-pink-400">
                                  <Flame className="h-3 w-3 mr-1" />
                                  #{index + 1} Trending
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Post Description */}
                          <div className="mb-4">
                            <ContentWithLinks content={post.content} />
                          </div>

                          {/* Post Image */}
                          {post.imageUrl && (
                            <div className="mb-4">
                              <Image 
                                src={post.imageUrl} 
                                alt={post.title}
                                width={400}
                                height={256}
                                className="rounded-lg max-w-full h-auto max-h-64 object-cover"
                              />
                            </div>
                          )}

                          {/* Stats */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-border/50">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Total Hype</p>
                              <p className="font-bold text-pink-400">
                                {(post.totalHype / 1e6).toFixed(6)} HYPE
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">TVL</p>
                              <p className="font-bold text-cyan-400">
                                {(post.reservedSol / 1e9).toFixed(6)} SOL
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Price</p>
                              <p className="font-bold text-green-400">
                                {post.hypePrice.toFixed(9)} SOL/HYPE
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Your Holdings</p>
                              <p className="font-bold text-purple-400">
                                {post.userHypeBalance ? (post.userHypeBalance / 1e6).toFixed(6) : '0'} HYPE
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className="border-green-500/50 text-green-400"
                              >
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {(post.totalHype / 1e6).toFixed(2)}M Total Hype
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-pink-500/50 hover:bg-pink-500/10 hover:border-pink-500"
                                onClick={() => handleHypeClick(post)}
                              >
                                <Flame className="h-4 w-4 mr-1" />
                                Trade Hype
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
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