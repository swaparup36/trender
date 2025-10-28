'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Flame, Coins, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useWallet } from '@solana/wallet-adapter-react';
import { initializePost } from '@/utils/smartcontractHandlers';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { usePosts } from '@/contexts/PostsContext';

export default function CreatePost() {
  const walletCtx = useWallet();
  const router = useRouter();
  const { refreshPosts } = usePosts();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (parseFloat(initialDeposit) < 0.1) {
      alert("Initial deposit must be at least 0.1 SOL");
      setIsSubmitting(false);
      return;
    }

    try {
      if (!walletCtx.publicKey) {
        console.error("Wallet not connected");
        return;
      }

      // POST request to /api/post/create
      const res = await axios.post('/api/post/create', {
        userPubKey: walletCtx.publicKey.toBase58(),
        title,
        content: description,
      });

      if (res.status !== 200) {
        console.log('Error creating post:', res.data.message);
        return;
      }

      const newPost = res.data.post;

      // Initiate blockchain transaction for creating new post
      const initiatePostPoolRes = await initializePost(walletCtx, Number(initialDeposit)*LAMPORTS_PER_SOL, newPost.id);
      if (!initiatePostPoolRes) {
        console.error("Error while initialize the post on chain");
        return;
      }

      // Refresh the posts list
      await refreshPosts();

      router.push('/');
    } catch (error) {
      console.error("Error creating post: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const depositAmount = parseFloat(initialDeposit) || 0;
  const estimatedHype = depositAmount > 0 ? Math.floor(depositAmount * LAMPORTS_PER_SOL * 10 / 1e6) : 0;

  return (
    <main className="min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/30 mb-4">
            <Sparkles className="h-4 w-4 text-pink-400" />
            <span className="text-sm font-medium text-pink-400">Create & Earn</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-400 via-cyan-400 to-green-400 bg-clip-text text-transparent">
            Create Your Post
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Launch your content with initial SOL liquidity. Get a chance to be featured and earn extra hype!
          </p>
        </div>

        <Card className="p-8 border-2 border-border/50 bg-card/50 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-semibold">
                Post Title *
              </Label>
              <Input
                id="title"
                type="text"
                placeholder="Enter an attention-grabbing title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-background/50 border-border/50 focus:border-cyan-500/50 text-lg"
              />
              <p className="text-xs text-muted-foreground">
                Make it catchy! This is what people will see first.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description *
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your content, idea, or project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={6}
                className="bg-background/50 border-border/50 focus:border-cyan-500/50 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Convince people to hype your content. What makes it special?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit" className="text-base font-semibold">
                Initial SOL Deposit *
              </Label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                <Input
                  id="deposit"
                  type="number"
                  step="0.01"
                  min="0.1"
                  placeholder="0.00"
                  value={initialDeposit}
                  onChange={(e) => setInitialDeposit(e.target.value)}
                  required
                  className="pl-10 bg-background/50 border-border/50 focus:border-green-500/50 text-lg font-mono"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-semibold text-green-400">
                  SOL
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 0.1 SOL required. Higher deposits create better liquidity.
              </p>
            </div>

            {depositAmount > 0 && (
              <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-pink-500/10 border border-cyan-500/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Initial Liquidity</span>
                    <span className="font-bold text-cyan-400">{depositAmount.toFixed(2)} SOL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Initial Hype Units</span>
                    <span className="font-bold text-pink-400">{estimatedHype}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fees</span>
                    <span className="font-bold text-green-400">2%</span>
                  </div>
                </div>
              </Card>
            )}

            <div className="pt-4 space-y-3">
              <Button
                type="submit"
                disabled={isSubmitting || !title || !description || depositAmount < 0.1}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 neon-glow-pink font-bold text-lg py-6"
              >
                {isSubmitting ? (
                  <>
                    <Flame className="h-5 w-5 mr-2 animate-spin" />
                    Creating Post...
                  </>
                ) : (
                  <>
                    <Flame className="h-5 w-5 mr-2" />
                    Launch Post
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full border-border/50 hover:bg-card/50"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>

        <Card className="mt-6 p-6 bg-yellow-500/5 border border-yellow-500/30">
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Sparkles className="h-5 w-5 text-yellow-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-yellow-400">How It Works</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Your initial SOL deposit creates the liquidity pool</li>
                <li>• Users can hype (buy) or unhype (sell) using bonding curve pricing</li>
                <li>• You get 10% hype extra on your account after creation that you can sell anytime</li>
                <li>• The more hype your post gets, the higher the price goes</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
