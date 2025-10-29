'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Flame, User } from 'lucide-react';
import { useState } from 'react';
import { TradeModal } from '@/components/trade-modal';
import { PostType } from '@/types/types';
import Image from 'next/image';
import { ContentWithLinks } from '@/components/content-with-links';

export function PostCard({
  id,
  title,
  content,
  creator,
  reservedSol,
  reservedHype,
  hypePrice,
  totalHype,
  userHypeBalance = 0,
  imageUrl,
}: PostType) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');

  const handleHype = () => {
    setTradeType('buy');
    setIsModalOpen(true);
  };

  const handleUnhype = () => {
    setTradeType('sell');
    setIsModalOpen(true);
  };

  return (
    <Card className="group relative overflow-hidden border-2 border-border/50 bg-card/50 backdrop-blur-sm hover:border-cyan-500/50 transition-all duration-300 hover:neon-glow">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative p-6 space-y-4">
        {imageUrl && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent line-clamp-2">
              {title}
            </h3>
            <ContentWithLinks content={content} maxPreviews={1} />
          </div>

          <Badge variant="outline" className="shrink-0 border-cyan-500/50 text-cyan-400">
            <Flame className="h-3 w-3 mr-1" />
            {totalHype/1e6} HYPE
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="font-mono truncate">{creator}</span>
        </div>

        <div className="grid grid-cols-3 gap-3 py-3 border-t border-b border-border/50">
          <div>
            <p className="text-xs text-muted-foreground mb-1">TVL</p>
            <p className="font-bold text-sm text-cyan-400">{(reservedSol/1e9).toFixed(2)} SOL</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Hype Price</p>
            <p className="font-bold text-sm text-pink-400">{(hypePrice).toFixed(9)} SOL</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Your Hype</p>
            <p className="font-bold text-sm text-green-400">{userHypeBalance/1e6}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleHype}
            className="flex-1 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 font-bold neon-glow-green"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            HYPE
          </Button>

          <Button
            onClick={handleUnhype}
            disabled={userHypeBalance === 0}
            variant="outline"
            className="flex-1 border-pink-500/50 hover:bg-pink-500/10 hover:border-pink-500 font-bold"
          >
            <TrendingDown className="h-4 w-4 mr-2" />
            UNHYPE
          </Button>
        </div>
      </div>

      <TradeModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        thisPost={{
          id,
          title,
          creator,
          reservedSol,
          reservedHype,
          hypePrice,
          totalHype,
          userHypeBalance,
          content,
          imageUrl
        }}
      />
    </Card>
  );
}
