import { Connection, PublicKey, Transaction, TransactionSignature } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

export interface TransactionOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly signature?: string,
    public readonly isSuccessful?: boolean
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

/**
 * Helper function to wait for transaction confirmation with proper error handling
 */
export async function waitForTransactionConfirmation(
  connection: Connection,
  signature: TransactionSignature,
  options: TransactionOptions = {}
): Promise<boolean> {
  const { maxRetries = 3, retryDelay = 1000, timeout = 30000 } = options;
  
  let attempts = 0;
  const startTime = Date.now();

  while (attempts < maxRetries && Date.now() - startTime < timeout) {
    try {
      const status = await connection.getSignatureStatus(signature);
      
      if (status.value) {
        if (status.value.err) {
          throw new TransactionError(
            `Transaction failed: ${JSON.stringify(status.value.err)}`,
            signature,
            false
          );
        }
        
        if (status.value.confirmationStatus === 'confirmed' || 
            status.value.confirmationStatus === 'finalized') {
          return true;
        }
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      attempts++;
    } catch (error: any) {
      if (error instanceof TransactionError) {
        throw error;
      }
      
      // Handle "already processed" errors as potentially successful
      if (error.message?.includes('already been processed')) {
        console.log('Transaction may have been processed successfully despite error');
        return true;
      }
      
      attempts++;
      if (attempts >= maxRetries) {
        throw new TransactionError(
          `Failed to confirm transaction after ${maxRetries} attempts: ${error.message}`,
          signature
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new TransactionError(
    `Transaction confirmation timeout after ${timeout}ms`,
    signature
  );
}

/**
 * Helper function to check if a transaction was successful even when confirmation fails
 */
export async function checkTransactionSuccess(
  connection: Connection,
  signature: TransactionSignature,
  publicKey: PublicKey
): Promise<boolean> {
  try {
    // Get transaction details
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    if (transaction) {
      // If we can fetch the transaction and it has no error, it was successful
      return transaction.meta?.err === null;
    }
    
    return false;
  } catch (error) {
    console.log('Could not fetch transaction details:', error);
    return false;
  }
}

/**
 * Enhanced transaction sender with retry logic
 */
export async function sendTransactionWithRetry(
  connection: Connection,
  transaction: Transaction,
  wallet: WalletContextState,
  options: TransactionOptions = {}
): Promise<TransactionSignature> {
  const { maxRetries = 3, retryDelay = 1000 } = options;
  
  if (!wallet.signTransaction) {
    throw new Error('Wallet does not support transaction signing');
  }
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get fresh blockhash for each attempt
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      // Sign and send transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'processed',
        maxRetries: 0, // Handle retries manually
      });
      
      return signature;
    } catch (error: any) {
      lastError = error;
      console.log(`Transaction attempt ${attempt + 1} failed:`, error.message);
      
      // Don't retry on certain errors
      if (error.message?.includes('insufficient funds') || 
          error.message?.includes('invalid signature')) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw lastError || new Error('Transaction failed after all retry attempts');
}

/**
 * Utility to handle the complete transaction flow with proper error handling
 */
export async function executeTransactionSafely<T>(
  transactionFn: () => Promise<TransactionSignature>,
  connection: Connection,
  wallet: WalletContextState,
  options: TransactionOptions = {}
): Promise<{ success: boolean; signature?: TransactionSignature; error?: string }> {
  try {
    // Execute the transaction
    const signature = await transactionFn();
    
    // Wait for confirmation
    const confirmed = await waitForTransactionConfirmation(connection, signature, options);
    
    if (confirmed) {
      return { success: true, signature };
    } else {
      // Check if transaction was actually successful despite confirmation issues
      if (wallet.publicKey) {
        const wasSuccessful = await checkTransactionSuccess(connection, signature, wallet.publicKey);
        if (wasSuccessful) {
          return { success: true, signature };
        }
      }
      
      return { 
        success: false, 
        signature, 
        error: 'Transaction confirmation failed' 
      };
    }
  } catch (error: any) {
    console.error('Transaction execution failed:', error);
    
    if (error instanceof TransactionError && error.isSuccessful) {
      return { success: true, signature: error.signature };
    }
    
    return { 
      success: false, 
      error: error.message || 'Unknown transaction error' 
    };
  }
}