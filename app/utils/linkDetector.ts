export interface LinkMetadata {
  url: string;
  type: 'youtube' | 'instagram' | 'twitter' | 'generic';
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
const INSTAGRAM_REGEX = /instagram\.com\/p\/([A-Za-z0-9_-]+)/;
const TWITTER_REGEX = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;

export function extractLinksFromText(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

export function getLinkType(url: string): LinkMetadata['type'] {
  if (YOUTUBE_REGEX.test(url)) return 'youtube';
  if (INSTAGRAM_REGEX.test(url)) return 'instagram';
  if (TWITTER_REGEX.test(url)) return 'twitter';
  return 'generic';
}

export function getYouTubeMetadata(url: string): Partial<LinkMetadata> {
  const match = url.match(YOUTUBE_REGEX);
  if (!match) return {};
  
  const videoId = match[1];
  return {
    type: 'youtube',
    title: 'YouTube Video',
    image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    domain: 'youtube.com'
  };
}

export function getInstagramMetadata(url: string): Partial<LinkMetadata> {
  const match = url.match(INSTAGRAM_REGEX);
  if (!match) return {};
  
  return {
    type: 'instagram',
    title: 'Instagram Post',
    domain: 'instagram.com'
  };
}

export function getTwitterMetadata(url: string): Partial<LinkMetadata> {
  const match = url.match(TWITTER_REGEX);
  if (!match) return {};
  
  return {
    type: 'twitter',
    title: 'Twitter/X Post',
    domain: 'twitter.com'
  };
}

export function getGenericMetadata(url: string): Partial<LinkMetadata> {
  try {
    const urlObj = new URL(url);
    return {
      type: 'generic',
      title: urlObj.hostname,
      domain: urlObj.hostname
    };
  } catch {
    return {
      type: 'generic',
      title: 'External Link',
      domain: 'unknown'
    };
  }
}

export function extractLinkMetadata(url: string): LinkMetadata {
  const type = getLinkType(url);
  let metadata: Partial<LinkMetadata>;

  switch (type) {
    case 'youtube':
      metadata = getYouTubeMetadata(url);
      break;
    case 'instagram':
      metadata = getInstagramMetadata(url);
      break;
    case 'twitter':
      metadata = getTwitterMetadata(url);
      break;
    default:
      metadata = getGenericMetadata(url);
  }

  return {
    url,
    type,
    title: 'Link Preview',
    description: '',
    image: '',
    domain: '',
    ...metadata
  };
}