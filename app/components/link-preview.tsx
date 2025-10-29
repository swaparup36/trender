'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Play, Instagram, Twitter } from 'lucide-react';
import Image from 'next/image';
import { LinkMetadata } from '@/utils/linkDetector';
import { useState } from 'react';

interface LinkPreviewProps {
  metadata: LinkMetadata;
}

export function LinkPreview({ metadata }: LinkPreviewProps) {
  const [imageError, setImageError] = useState(false);

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(metadata.url, '_blank', 'noopener,noreferrer');
  };

  const getIcon = () => {
    switch (metadata.type) {
      case 'youtube':
        return <Play className="h-4 w-4 text-red-500" />;
      case 'instagram':
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case 'twitter':
        return <Twitter className="h-4 w-4 text-blue-500" />;
      default:
        return <ExternalLink className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeColor = () => {
    switch (metadata.type) {
      case 'youtube':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'instagram':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
      case 'twitter':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/30';
    }
  };

  return (
    <Card 
      className="mt-2 p-3 border border-border/50 bg-background/30 hover:bg-background/50 transition-colors cursor-pointer group"
      onClick={handleLinkClick}
    >
      <div className="flex gap-3">
        {/* Image/Thumbnail */}
        {metadata.image && !imageError && (
          <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted/20">
            <Image
              src={metadata.image}
              alt={metadata.title || 'Link preview'}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
              onError={() => setImageError(true)}
            />
            {metadata.type === 'youtube' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="h-6 w-6 text-white" fill="white" />
              </div>
            )}
          </div>
        )}

        {/* Fallback icon when no image or image error */}
        {(!metadata.image || imageError) && (
          <div className="w-16 h-16 rounded-md bg-muted/20 flex items-center justify-center flex-shrink-0">
            {getIcon()}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-sm truncate group-hover:text-cyan-400 transition-colors">
              {metadata.title}
            </p>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${getBadgeColor()}`}>
              {metadata.domain}
            </Badge>
          </div>
          
          {metadata.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
              {metadata.description}
            </p>
          )}
          
          <p className="text-xs text-muted-foreground truncate">
            {metadata.url.length > 40 ? `${metadata.url.substring(0, 37)}...` : metadata.url}
          </p>
        </div>
      </div>
    </Card>
  );
}

interface LinkPreviewContainerProps {
  content: string;
}

export function LinkPreviewContainer({ content }: LinkPreviewContainerProps) {
  // This component will be imported and used in the main component
  // We'll implement the link detection and preview rendering logic here
  return null; // Placeholder for now
}