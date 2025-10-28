import { Card } from '@/components/ui/card';
import { TrendingUp, Coins, Flame, DollarSign } from 'lucide-react';

interface StatsBarProps {
  totalPosts?: number;
  totalVolume?: number;
  totalHype?: number;
}

export function StatsBar({
  totalPosts = 0,
  totalVolume = 0,
  totalHype = 0,
}: StatsBarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-4 border-cyan-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Posts</p>
            <p className="text-2xl font-bold text-cyan-400">{totalPosts}</p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/10">
            <Flame className="h-6 w-6 text-cyan-400" />
          </div>
        </div>
      </Card>

      <Card className="p-4 border-pink-500/30 bg-card/50 backdrop-blur-sm hover:neon-glow-pink transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Volume</p>
            <p className="text-2xl font-bold text-pink-400">{(totalVolume/1e9).toFixed(2)} SOL</p>
          </div>
          <div className="p-3 rounded-lg bg-pink-500/10">
            <DollarSign className="h-6 w-6 text-pink-400" />
          </div>
        </div>
      </Card>

      <Card className="p-4 border-yellow-500/30 bg-card/50 backdrop-blur-sm hover:shadow-yellow-500/20 hover:shadow-lg transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Hype</p>
            <p className="text-2xl font-bold text-yellow-400">{totalHype/1e6}</p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10">
            <Coins className="h-6 w-6 text-yellow-400" />
          </div>
        </div>
      </Card>
    </div>
  );
}
