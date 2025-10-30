'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { PostType } from '@/types/types';
import { getPostPoolAccount, getUserHypeRecord } from '@/utils/smartcontractHandlers';

interface PostsContextType {
  allPosts: PostType[];
  setAllPosts: React.Dispatch<React.SetStateAction<PostType[]>>;
  isLoading: boolean;
  error: string | null;
  getAllPosts: () => Promise<void>;
  refreshPosts: () => Promise<void>;
}

const PostsContext = createContext<PostsContextType | undefined>(undefined);

interface PostsProviderProps {
  children: ReactNode;
}

export function PostsProvider({ children }: PostsProviderProps) {
  const walletCtx = useWallet();
  const [allPosts, setAllPosts] = useState<PostType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAllPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const getAllPostsRes = await axios.get('/api/post/get-all', {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      if (getAllPostsRes.status !== 200) {
        console.error("Error getting all posts: ", getAllPostsRes.data.message);
        setError(getAllPostsRes.data.message || "Failed to fetch posts");
        return;
      }

      let allPosts: PostType[] = [];
      for (let post of getAllPostsRes.data.allPosts) {
        const postPool = await getPostPoolAccount(walletCtx, new PublicKey(post.userPubKey), post.id);
        if (!postPool) {
          console.log("No post pool PDA found");
          continue;
        }

        let hypeRecord = null;
        try {
          hypeRecord = await getUserHypeRecord(walletCtx, new PublicKey(post.userPubKey), post.id);
        } catch (error) {
          // User do not have a hype record for this post
        }

        // console.log("reservedHype: ", postPool.reservedHype.toNumber());
        // console.log("reservedSol: ", postPool.reservedSol.toNumber());

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

        // console.log("post to push: ", postDetails);

        allPosts.push(postDetails);
      }

      setAllPosts(allPosts);
    } catch (error) {
      console.error("Unable to get all the posts: ", error);
      setError("Failed to fetch posts");
    } finally {
      setIsLoading(false);
    }
  }, [walletCtx]);

  const refreshPosts = async () => {
    await getAllPosts();
  };

  useEffect(() => {
    if (walletCtx.connected) {
      getAllPosts();
    }
  }, [walletCtx.connected, getAllPosts]);

  const value: PostsContextType = {
    allPosts,
    setAllPosts,
    isLoading,
    error,
    getAllPosts,
    refreshPosts,
  };

  return (
    <PostsContext.Provider value={value}>
      {children}
    </PostsContext.Provider>
  );
}

export function usePosts() {
  const context = useContext(PostsContext);
  if (context === undefined) {
    throw new Error('usePosts must be used within a PostsProvider');
  }
  return context;
}