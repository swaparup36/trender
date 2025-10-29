'use client';

import { LinkPreview } from '@/components/link-preview';
import { extractLinksFromText, extractLinkMetadata } from '@/utils/linkDetector';

interface ContentWithLinksProps {
  content: string;
  maxPreviews?: number;
}

export function ContentWithLinks({ content, maxPreviews = 2 }: ContentWithLinksProps) {
  const links = extractLinksFromText(content);
  const uniqueLinks = Array.from(new Set(links));
  const linksToPreview = uniqueLinks.slice(0, maxPreviews);

  const renderContentWithClickableLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {part.length > 50 ? `${part.substring(0, 47)}...` : part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div>
      {/* Render content with clickable links */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {renderContentWithClickableLinks(content)}
      </p>

      {/* Render link previews */}
      {linksToPreview.length > 0 && (
        <div className="space-y-2">
          {linksToPreview.map((link, index) => {
            const metadata = extractLinkMetadata(link);
            return (
              <LinkPreview 
                key={`${link}-${index}`} 
                metadata={metadata}
              />
            );
          })}
          
          {uniqueLinks.length > maxPreviews && (
            <p className="text-xs text-muted-foreground mt-2">
              + {uniqueLinks.length - maxPreviews} more link{uniqueLinks.length - maxPreviews > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}