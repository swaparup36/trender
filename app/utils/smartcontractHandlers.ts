import * as anchor from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { getAnchorClient } from "./anchorClient";
import { PublicKey } from "@solana/web3.js";
import { executeTransactionSafely, TransactionError } from "./transactionHelpers";

export async function initializePost(wallet: WalletContextState, depositLamports: number, postId: number) {
    const { program, provider } = getAnchorClient(wallet);
    
    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return { success: false, error: "Wallet not connected" };
    }

    try {
        // Derive the PDA for the post pool
        const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("post"),
                wallet.publicKey.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );

        const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vault"),
                wallet.publicKey.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );

        const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("treasury")],
            program.programId
        );

        // Execute transaction safely
        const result = await executeTransactionSafely(
            async () => {
                return await program.methods
                    .initializePost(new anchor.BN(postId), new anchor.BN(depositLamports))
                    .accounts({
                        creator: wallet.publicKey!,
                        postPool: postPoolPda,
                        postVault: postVaultPda,
                        treasury: treasuryPda,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc({
                        skipPreflight: false,
                        preflightCommitment: 'confirmed',
                        commitment: 'confirmed'
                    });
            },
            provider.connection,
            wallet,
            { maxRetries: 3, timeout: 60000 }
        );

        if (result.success) {
            console.log("Initialize post transaction successful:", result.signature);
            return { success: true, signature: result.signature };
        } else {
            console.error("Initialize post transaction failed:", result.error);
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        console.error("Initialize post failed:", error);
        return { 
            success: false, 
            error: error.message || "Unknown error occurred" 
        };
    }
}

export async function getPostPoolAccount(wallet: WalletContextState, postCreator: PublicKey | string, postId: number) {
    const { program } = getAnchorClient(wallet);

    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return;
    }

    try {
        const creatorPublicKey = typeof postCreator === 'string' 
            ? new PublicKey(postCreator) 
            : postCreator;

        // Derive the PDA for the post pool
        const [postPoolPda, bump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("post"),
                creatorPublicKey.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );

        // Fetch the account data
        const postPool = await (program.account as any).postPool.fetch(postPoolPda);

        console.log("postPool found: ", postPool.reservedHype.toNumber(), postPool.reservedSol.toNumber());

        return postPool;
    } catch (error) {
        console.error("Failed to fetch post pool account:", error);
        return;
    }
}

export async function hypePost(wallet: WalletContextState, postCreator: PublicKey, postId: number, hypeAmount: number, maxAcceptablePrice: number) {
    const { program, provider } = getAnchorClient(wallet);
    
    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return { success: false, error: "Wallet not connected" };
    }

    try {
        const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("post"),
                postCreator.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );

        const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vault"),
                postCreator.toBuffer(),
                new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
            ],
            program.programId
        );

        const [userHypeRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("hype_record"),
                wallet.publicKey.toBuffer(),
                postPoolPda.toBuffer(),
            ],
            program.programId
        );

        const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("treasury")],
            program.programId
        );

        console.log("Hype amount: ", hypeAmount);
        console.log("Max acceptable price: ", Math.floor(maxAcceptablePrice));

        // Execute transaction safely
        const result = await executeTransactionSafely(
            async () => {
                return await program.methods
                    .hype(new anchor.BN(hypeAmount), new anchor.BN(postId), new anchor.BN(Math.floor(maxAcceptablePrice)))
                    .accounts({
                        buyer: wallet.publicKey!,
                        postPool: postPoolPda,
                        postVault: postVaultPda,
                        hypeRecord: userHypeRecordPda,
                        treasury: treasuryPda,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc({
                        skipPreflight: false,
                        preflightCommitment: 'confirmed',
                        commitment: 'confirmed'
                    });
            },
            provider.connection,
            wallet,
            { maxRetries: 3, timeout: 60000 }
        );

        if (result.success) {
            console.log("Hype post transaction successful:", result.signature);
            return { success: true, signature: result.signature };
        } else {
            console.error("Hype post transaction failed:", result.error);
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        console.error("Failed to hype post: ", error);
        return { 
            success: false, 
            error: error.message || "Unknown error occurred" 
        };
    }
}

export async function getUserHypeRecord(wallet: WalletContextState, postCreator: PublicKey, postId: number) {
    const { program } = getAnchorClient(wallet);

    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return;
    }

    try {
        const creatorPublicKey = typeof postCreator === 'string' 
            ? new PublicKey(postCreator) 
            : postCreator;
        const [postPoolPda, bump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("post"),
                creatorPublicKey.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );
        const [userHypeRecordPda, hypeBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("hype_record"),
                wallet.publicKey.toBuffer(),
                postPoolPda.toBuffer(),
            ],
            program.programId
        );

        // Fetch the account data
        const hypeRecord = await (program.account as any).hypeRecord.fetch(userHypeRecordPda);

        return hypeRecord;
    } catch (error) {
        console.error("Failed to fetch user hype record: ", error);
        return;
    }
}

export async function unhypePost(wallet: WalletContextState, postCreator: PublicKey, postId: number, sellAmount: number, minAcceptableRefund: number) {
    const { program, provider } = getAnchorClient(wallet);

    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return { success: false, error: "Wallet not connected" };
    }

    try {
        const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("post"),
                postCreator.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );

        const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vault"),
                postCreator.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );

        const [userHypeRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("hype_record"),
                wallet.publicKey.toBuffer(),
                postPoolPda.toBuffer(),
            ],
            program.programId
        );

        const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("treasury")],
            program.programId
        );

        console.log("Min SOL to receive: ", Math.floor(minAcceptableRefund));
        console.log("Hype to sell: ", sellAmount);

        // Execute transaction safely
        const result = await executeTransactionSafely(
            async () => {
                return await program.methods
                    .unhype(new anchor.BN(sellAmount), new anchor.BN(postId), new anchor.BN(Math.floor(minAcceptableRefund)))
                    .accounts({
                        user: wallet.publicKey!,
                        postPool: postPoolPda,
                        postVault: postVaultPda,
                        hypeRecord: userHypeRecordPda,
                        treasury: treasuryPda,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc({
                        skipPreflight: false,
                        preflightCommitment: 'confirmed',
                        commitment: 'confirmed'
                    });
            },
            provider.connection,
            wallet,
            { maxRetries: 3, timeout: 60000 }
        );

        if (result.success) {
            console.log("Unhype post transaction successful:", result.signature);
            return { success: true, signature: result.signature };
        } else {
            console.error("Unhype post transaction failed:", result.error);
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        console.error("Failed to unhype post: ", error);
        return { 
            success: false, 
            error: error.message || "Unknown error occurred" 
        };
    }
}

export async function creatorReleaseHype(wallet: WalletContextState, postCreator: PublicKey,  postId: number, releaseAmount: number) {
    const { program, provider } = getAnchorClient(wallet);

    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return;
    }

    if (wallet.publicKey !== postCreator) {
        console.error("Only the post creator can release hype");
        return;
    }

    try {
        const [postPoolPda, bump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("post"),
                wallet.publicKey.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );

        const [postVaultPda, postVaultBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vault"),
                wallet.publicKey.toBuffer(),
                Buffer.from(new anchor.BN(postId).toArray("le", 8)),
            ],
            program.programId
        );

        const tx = await program.methods
            .creatorReleaseHype(new anchor.BN(releaseAmount), new anchor.BN(postId))
            .accounts({
                user: wallet.publicKey,
                postPool: postPoolPda,
                postVault: postVaultPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        // Confirm the transaction
        const latestBlockhash = await provider.connection.getLatestBlockhash();
        const confirmation = await provider.connection.confirmTransaction({
            signature: tx,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, "confirmed");

        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        console.log("Transaction successful:", tx);
        return true;
    } catch (error) {
        console.error("Failed to release hype: ", error);
        return;
    }
}

export async function withdrawTreasury(wallet: WalletContextState, amount: number, recipient: PublicKey) {
    const { program, provider } = getAnchorClient(wallet);

    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return;
    }

    try {
        const [configPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("config")],
            program.programId
        );
        const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("treasury")],
            program.programId
        );
        const tx = await program.methods
            .withdrawTreasury(new anchor.BN(amount))
            .accounts({
                authority: wallet.publicKey,
                config: configPda,
                treasury: treasuryPda,
                recipient: recipient,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        // Confirm the transaction
        const latestBlockhash = await provider.connection.getLatestBlockhash();
        const confirmation = await provider.connection.confirmTransaction({
            signature: tx,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, "confirmed");

        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        console.log("Transaction successful:", tx);
        return true;
    } catch (error) {
        console.error("Failed to release hype: ", error);
        return;
    }
}

export async function initiateTreasury(wallet: WalletContextState) {
    const { program, provider } = getAnchorClient(wallet);

    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return;
    }

    try {
        const [configPda] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("config")], program.programId);
        const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("treasury")], program.programId);

        const tx = await program.methods
            .initializeTreasury()
            .accounts({
                payer: wallet.publicKey,
                config: configPda,
                treasury: treasuryPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        // Confirm the transaction
        const latestBlockhash = await provider.connection.getLatestBlockhash();
        const confirmation = await provider.connection.confirmTransaction({
            signature: tx,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, "confirmed");

        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        console.log("Transaction successful:", tx);
        return true;
    } catch (error) {
        console.error("Failed to initiate treasury: ", error);
        return;
    }
}
