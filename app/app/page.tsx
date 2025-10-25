'use client';

import { StatsBar } from '@/components/stats-bar';
import { PostCard } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Flame } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { PostType } from '@/types/types';
import { getPostPoolAccount, getUserHypeRecord } from '@/utils/smartcontractHandlers';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

// const mockPosts = [
//   {
//     id: '1',
//     title: 'The Future of Solana NFTs',
//     description: 'Exploring the next generation of NFT technology on Solana. Join the hype train and support innovation!',
//     creator: '7xKXtG...9sYpQ',
//     solLocked: 15.5,
//     hypePrice: 0.0234,
//     totalHype: 1250,
//     userHypeBalance: 50,
//   },
//   {
//     id: '2',
//     title: 'DeFi Revolution 2024',
//     description: 'Breaking down the latest DeFi protocols that are changing the game. The future is here!',
//     creator: '4mNpKr...3fTwX',
//     solLocked: 28.3,
//     hypePrice: 0.0456,
//     totalHype: 2150,
//     userHypeBalance: 0,
//   },
//   {
//     id: '3',
//     title: 'Building on Solana: A Guide',
//     description: 'Complete guide to building high-performance dApps on Solana. From zero to hero!',
//     creator: '9wQzLs...7hPmK',
//     solLocked: 42.7,
//     hypePrice: 0.0789,
//     totalHype: 3420,
//     userHypeBalance: 120,
//   },
//   {
//     id: '4',
//     title: 'Web3 Gaming Takes Off',
//     description: 'The gaming industry is being revolutionized by Web3. Here\'s what you need to know.',
//     creator: '5xYzMn...2kRqP',
//     solLocked: 18.9,
//     hypePrice: 0.0312,
//     totalHype: 1680,
//     userHypeBalance: 25,
//   },
//   {
//     id: '5',
//     title: 'Metaverse Real Estate',
//     description: 'Investing in virtual land is becoming more lucrative. Don\'t miss this opportunity!',
//     creator: '8nTpVx...4cWmL',
//     solLocked: 35.2,
//     hypePrice: 0.0567,
//     totalHype: 2890,
//     userHypeBalance: 0,
//   },
//   {
//     id: '6',
//     title: 'DAO Governance Best Practices',
//     description: 'How to build and manage successful DAOs. Learn from the best in the industry.',
//     creator: '3kPzWq...6fNhJ',
//     solLocked: 21.4,
//     hypePrice: 0.0398,
//     totalHype: 1920,
//     userHypeBalance: 75,
//   },
// ];

export default function Home() {
  const walletCtx = useWallet();
  const [allPosts, setAllPosts] = useState<PostType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const getAllPosts = async () => {
    try {
      const getAllPostsRes = await axios.get('/api/post/get-all');

      if (getAllPostsRes.status !== 200) {
        console.error("Error getting all posts: ", getAllPostsRes.data.message)
      }

      let allPosts: PostType[] = [];
      for (let post of getAllPostsRes.data.allPosts) {
        const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.userPubKey), post.id);
        if (!postPool) {
          console.log("No post pool PDA found");
          continue;
        }

        const hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.userPubKey), post.id);
        // if (!hypeRecord) {
        //   console.log("No hype record PDA found");
        //   continue;
        // }

        const ammConstant = postPool.reservedHype.toNumber() * postPool.reservedSol.toNumber();
        const newReservedHype = postPool.reservedHype.toNumber() - 10000;
        const newReservedSol = ammConstant/newReservedHype;
        const price = newReservedSol - postPool.reservedSol.toNumber();

        let postDetails: PostType = {
          id: post.id,
          title: post.title,
          content: post.content,
          creator: post.userPubKey,
          hypePrice: price,
          reservedSol: postPool.reservedSol.toNumber(),
          totalHype: postPool.totalHype.toNumber(),
          userHypeBalance: hypeRecord ? hypeRecord.amount.toNumber() : 0
        }

        console.log("post to push: ", postDetails);

        allPosts.push(postDetails);
      }

      setAllPosts(allPosts);
    } catch (error) {
      console.error("Unable to get all the posts");
      return;
    }
  }

  const filteredPosts = allPosts.filter(
    post =>
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalVolume = allPosts.reduce((sum, post) => sum + post.reservedSol, 0);
  const totalHype = allPosts.reduce((sum, post) => sum + post.totalHype, 0);

  useEffect(() => {
    getAllPosts();
  }, [walletCtx.connected]);

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-4 py-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4">
            <Flame className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-400">Powered by Solana</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-green-400 bg-clip-text text-transparent leading-tight">
            Hype What You Love
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Support creators through AMM-style bonding curves. Buy hype, sell hype, earn rewards.
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
            >
              Create Post
            </Button>
          </div>
        </div>

        <StatsBar
          totalPosts={allPosts.length}
          totalVolume={totalVolume}
          activeUsers={1234}
          totalHype={totalHype}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Trending Posts</h2>
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
            {filteredPosts.map((post) => (
              <PostCard key={post.id} {...post} />
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
