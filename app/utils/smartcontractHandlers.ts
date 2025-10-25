import * as anchor from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { getAnchorClient } from "./anchorClient";
import { PublicKey } from "@solana/web3.js";

export async function initializePost(wallet: WalletContextState, depositLamports: number, postId: number) {
    const { program, provider } = getAnchorClient(wallet);

    if (!wallet.publicKey) {
        console.error("Wallet not connected");
        return;
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

        // Create the transaction to initialize the post ans sign it
        const tx = await program.methods
            .initializePost(new anchor.BN(postId), new anchor.BN(depositLamports))
            .accounts({
                creator: wallet.publicKey,
                postPool: postPoolPda,
                postVault: postVaultPda,
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
    } catch (err) {
        console.error("Transaction failed:", err);
        return;
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
        return;
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

        const tx = await program.methods
            .hype(new anchor.BN(hypeAmount), new anchor.BN(postId), new anchor.BN(maxAcceptablePrice))
            .accounts({
                buyer: wallet.publicKey,
                postPool: postPoolPda,
                postVault: postVaultPda,
                hypeRecord: userHypeRecordPda,
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
        console.error("Failed to hype post: ", error);
        return;
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
        return;
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

        const tx = await program.methods
            .unhype(new anchor.BN(sellAmount), new anchor.BN(postId), new anchor.BN(minAcceptableRefund))
            .accounts({
                user: wallet.publicKey,
                postPool: postPoolPda,
                postVault: postVaultPda,
                hypeRecord: userHypeRecordPda,
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
        return {};
    } catch (error) {
        console.error("Failed to unhype post: ", error);
        return;
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
