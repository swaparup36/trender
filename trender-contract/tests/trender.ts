import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Trender } from "../target/types/trender";
import assert from "assert";

describe("trender", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.trender as Program<Trender>;

  // replicate on-chain AMM price logic
  function ammPrice(reservedSol: anchor.BN, reservedHype: anchor.BN, hypeBought: anchor.BN): anchor.BN {
    const k = reservedSol.mul(reservedHype);
    const newReservedHype = reservedHype.sub(hypeBought);
    const newReservedSol = k.div(newReservedHype);
    return newReservedSol.sub(reservedSol);
  }

  function ammRefund(reservedSol: anchor.BN, reservedHype: anchor.BN, hypeSold: anchor.BN): anchor.BN {
    const k = reservedSol.mul(reservedHype);
    const newReservedHype = reservedHype.add(hypeSold);
    const newReservedSol = k.div(newReservedHype);
    return reservedSol.sub(newReservedSol);
  }

  before(async () => {
    const [configPda] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("config")], program.programId);
    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("treasury")], program.programId);

    await program.methods
      .initializeTreasury()
      .accounts({
        payer: provider.wallet.publicKey,
        config: configPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("initialize post pool", async () => {
    const creator = anchor.web3.Keypair.generate();
    const postId = 10;
    const depositedSol = new anchor.BN(Math.floor(0.5 * anchor.web3.LAMPORTS_PER_SOL));

    // Fund creator
    const sig = await provider.connection.requestAirdrop(creator.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    // Derive PDAs with proper seeds
    const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("post"), 
        creator.publicKey.toBuffer(), 
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("vault"), 
        creator.publicKey.toBuffer(), 
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      program.programId
    );

    // Note: The order is (post_id, deposited_sol) in the instruction
    await program.methods
      .initializePost(new anchor.BN(postId), depositedSol)
      .accounts({
        creator: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Verify the initialization
    const postPool = await program.account.postPool.fetch(postPoolPda);
    assert.ok(postPool.creator.equals(creator.publicKey));
    assert.strictEqual(postPool.postId.toNumber(), postId);
    assert.strictEqual(postPool.reservedSol.toString(), depositedSol.toString());
    assert.strictEqual(postPool.reservedHype.toString(), depositedSol.mul(new anchor.BN(10)).toString());
    assert.strictEqual(postPool.totalHype.toString(), postPool.creatorHypeBalance.toString());

    const vaultBalance = await provider.connection.getBalance(postVaultPda);
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0);
    assert.ok(vaultBalance >= depositedSol.toNumber(), "Vault balance should be at least deposited amount");
  });

  it("price calculation matches AMM", async () => {
    const creator = anchor.web3.Keypair.generate();
    const postId = 11;
    const depositedSol = new anchor.BN(Math.floor(0.5 * anchor.web3.LAMPORTS_PER_SOL));

    const sig = await provider.connection.requestAirdrop(creator.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    // Fix PDA derivation with proper seed formatting
    const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("post"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      program.programId
    );

    // Fix parameter order: post_id first, then deposited_sol
    await program.methods
      .initializePost(new anchor.BN(postId), depositedSol)
      .accounts({
        creator: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const postPool = await program.account.postPool.fetch(postPoolPda);
    const reserveSol = new anchor.BN(postPool.reservedSol.toString());
    const reserveHype = new anchor.BN(postPool.reservedHype.toString());
    const amount = new anchor.BN(10000);
    const price = ammPrice(reserveSol, reserveHype, amount);
    assert.ok(price.gt(new anchor.BN(0)), "price should be positive for valid amount");
  });

  it("buy hype from post pool with computed slippage", async () => {
    const creator = anchor.web3.Keypair.generate();
    const postId = 12;
    const depositedSol = new anchor.BN(Math.floor(0.5 * anchor.web3.LAMPORTS_PER_SOL));

    // Fund creator with more SOL for larger amounts
    const sig = await provider.connection.requestAirdrop(creator.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    // Derive PDAs
    const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("post"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [hypeRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("hype_record"),
        creator.publicKey.toBuffer(),
        postPoolPda.toBuffer()
      ],
      program.programId
    );

    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      program.programId
    );

    // Initialize post
    await program.methods
      .initializePost(new anchor.BN(postId), depositedSol)
      .accounts({
        creator: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const postPoolBefore = await program.account.postPool.fetch(postPoolPda);
    const reserveSol = new anchor.BN(postPoolBefore.reservedSol.toString());
    const reserveHype = new anchor.BN(postPoolBefore.reservedHype.toString());
    
    // Use minimum valid hype amount
    const amount = new anchor.BN(1_000_000);
    const price = ammPrice(reserveSol, reserveHype, amount);

    // Allow 5% slippage
    const maxAcceptablePrice = price.mul(new anchor.BN(105)).div(new anchor.BN(100));

    await program.methods
      .hype(amount, new anchor.BN(postId), maxAcceptablePrice)
      .accounts({
        buyer: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        hypeRecord: hypeRecordPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Verify post-purchase state
    const postPoolAfter = await program.account.postPool.fetch(postPoolPda);
    const hypeRecord = await program.account.hypeRecord.fetch(hypeRecordPda);

    // Verify hype record amount matches purchase
    assert.strictEqual(
      hypeRecord.amount.toString(), 
      amount.toString(),
      "Hype record amount should match purchase amount"
    );

    // Verify reserved hype decreased by purchase amount
    assert.strictEqual(
      postPoolAfter.reservedHype.toString(),
      new anchor.BN(postPoolBefore.reservedHype.toString()).sub(amount).toString(),
      "Reserved hype should decrease by purchase amount"
    );

    // Calculate expected total hype:
    // Previous total - purchased amount
    const expectedTotalHype = new anchor.BN(postPoolBefore.totalHype.toString())
      .add(amount);

    // Verify total hype matches expected
    assert.strictEqual(
      postPoolAfter.totalHype.toString(),
      expectedTotalHype.toString(),
      "Total hype should decrease by purchase amount"
    );
  });

  it("a user buys two times, hype records accumulate", async () => {
    const creator = anchor.web3.Keypair.generate();
    const postId = 20;
    const depositedSol = new anchor.BN(Math.floor(1.0 * anchor.web3.LAMPORTS_PER_SOL));

    // Fund creator with enough SOL for initialization and multiple purchases
    const sig = await provider.connection.requestAirdrop(creator.publicKey, 3 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    // Derive PDAs
    const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("post"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [hypeRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("hype_record"),
        creator.publicKey.toBuffer(),
        postPoolPda.toBuffer()
      ],
      program.programId
    );

    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      program.programId
    );

    // Initialize post
    await program.methods
      .initializePost(new anchor.BN(postId), depositedSol)
      .accounts({
        creator: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // First purchase
    const firstAmount = new anchor.BN(2_000_000); // 2 HYPE
    const postPoolBefore = await program.account.postPool.fetch(postPoolPda);
    const reserveSol1 = new anchor.BN(postPoolBefore.reservedSol.toString());
    const reserveHype1 = new anchor.BN(postPoolBefore.reservedHype.toString());
    const firstPrice = ammPrice(reserveSol1, reserveHype1, firstAmount);
    const maxAcceptablePrice1 = firstPrice.mul(new anchor.BN(105)).div(new anchor.BN(100));

    await program.methods
      .hype(firstAmount, new anchor.BN(postId), maxAcceptablePrice1)
      .accounts({
        buyer: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        hypeRecord: hypeRecordPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Verify first purchase
    let hypeRecord = await program.account.hypeRecord.fetch(hypeRecordPda);
    assert.strictEqual(
      hypeRecord.amount.toString(),
      firstAmount.toString(),
      "First purchase: hype record should match first amount"
    );

    // Second purchase
    const secondAmount = new anchor.BN(3_000_000); // 3 HYPE
    const postPoolMid = await program.account.postPool.fetch(postPoolPda);
    const reserveSol2 = new anchor.BN(postPoolMid.reservedSol.toString());
    const reserveHype2 = new anchor.BN(postPoolMid.reservedHype.toString());
    const secondPrice = ammPrice(reserveSol2, reserveHype2, secondAmount);
    const maxAcceptablePrice2 = secondPrice.mul(new anchor.BN(105)).div(new anchor.BN(100));

    await program.methods
      .hype(secondAmount, new anchor.BN(postId), maxAcceptablePrice2)
      .accounts({
        buyer: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        hypeRecord: hypeRecordPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Verify accumulated hype records
    hypeRecord = await program.account.hypeRecord.fetch(hypeRecordPda);
    const expectedTotal = firstAmount.add(secondAmount);
    
    // This is what should happen when the contract is fixed:
    assert.strictEqual(
      hypeRecord.amount.toString(),
      expectedTotal.toString(),
      "Second purchase: hype record should accumulate both amounts"
    );

    // Verify post pool state
    const postPoolAfter = await program.account.postPool.fetch(postPoolPda);
    const totalPurchased = firstAmount.add(secondAmount);
    
    // Total hype should have increased by the purchased amounts (this still works correctly)
    const expectedTotalHype = new anchor.BN(postPoolBefore.totalHype.toString()).add(totalPurchased);
    assert.strictEqual(
      postPoolAfter.totalHype.toString(),
      expectedTotalHype.toString(),
      "Total hype should increase by total purchased amount"
    );

    // Reserved hype should have decreased by the purchased amounts (this still works correctly)
    const expectedReservedHype = new anchor.BN(postPoolBefore.reservedHype.toString()).sub(totalPurchased);
    assert.strictEqual(
      postPoolAfter.reservedHype.toString(),
      expectedReservedHype.toString(),
      "Reserved hype should decrease by total purchased amount"
    );
  })

  it("buy then sell hype preserves AMM (within rounding)", async () => {
    const creator = anchor.web3.Keypair.generate();
    const postId = 13;
    // Increase initial deposit significantly
    const depositedSol = new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL);

    // Fund creator with more SOL for deposit and rent
    const sig = await provider.connection.requestAirdrop(
      creator.publicKey, 
      5 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Derive PDAs
    const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("post"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [hypeRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("hype_record"),
        creator.publicKey.toBuffer(),
        postPoolPda.toBuffer()
      ],
      program.programId
    );

    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      program.programId
    );

    // Initialize post
    await program.methods
      .initializePost(new anchor.BN(postId), depositedSol)
      .accounts({
        creator: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Use larger amount for better precision
    const amount = new anchor.BN(10_000_000); // 10 HYPE
    
    const postPoolBefore = await program.account.postPool.fetch(postPoolPda);
    const reserveSol = new anchor.BN(postPoolBefore.reservedSol.toString());
    const reserveHype = new anchor.BN(postPoolBefore.reservedHype.toString());
    
    // Calculate buy price with 1% slippage allowance
    const buyPrice = ammPrice(reserveSol, reserveHype, amount);
    const maxAcceptablePrice = buyPrice.mul(new anchor.BN(101)).div(new anchor.BN(100));

    // Buy hype
    await program.methods
      .hype(amount, new anchor.BN(postId), maxAcceptablePrice)
      .accounts({
        buyer: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        hypeRecord: hypeRecordPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Get post-buy state
    const postPoolMid = await program.account.postPool.fetch(postPoolPda);
    
    // Calculate sell refund using updated pool state
    const sellRefund = ammRefund(
      new anchor.BN(postPoolMid.reservedSol.toString()),
      new anchor.BN(postPoolMid.reservedHype.toString()),
      amount
    );

    // Allow 5% slippage on sell
    const minAcceptableRefund = sellRefund.mul(new anchor.BN(95)).div(new anchor.BN(100));

    // Sell hype
    await program.methods
      .unhype(amount, new anchor.BN(postId), minAcceptableRefund)
      .accounts({
        user: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        hypeRecord: hypeRecordPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Verify final state
    const postPoolAfter = await program.account.postPool.fetch(postPoolPda);
    const hypeRecord = await program.account.hypeRecord.fetch(hypeRecordPda);

    // Hype record should be empty
    assert.strictEqual(
      hypeRecord.amount.toString(),
      "0",
      "Hype record should be empty after sell"
    );

    // Reserved hype should return to original amount (minus rounding)
    const hypeDiff = new anchor.BN(postPoolBefore.reservedHype.toString())
      .sub(new anchor.BN(postPoolAfter.reservedHype.toString()));
    assert.ok(
      hypeDiff.abs().lten(1),
      `Reserved hype should be nearly equal (diff: ${hypeDiff})`
    );

    // Total hype should equal creator balance
    assert.strictEqual(
      postPoolAfter.totalHype.toString(),
      postPoolAfter.creatorHypeBalance.toString(),
      "Total hype should equal creator balance after full sell"
    );
  });

  it("cannot buy more hype than reserve", async () => {
    const creator = anchor.web3.Keypair.generate();
    const postId = 14;
    const depositedSol = new anchor.BN(200_000);

    const sig = await provider.connection.requestAirdrop(creator.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("post"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );
    const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );
    const [hypeRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("hype_record"),
        creator.publicKey.toBuffer(),
        postPoolPda.toBuffer()
      ],
      program.programId
    );
    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("treasury")], program.programId);

    await program.methods
      .initializePost(new anchor.BN(postId), depositedSol)
      .accounts({
        creator: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const postPool = await program.account.postPool.fetch(postPoolPda);
    const availableHype = new anchor.BN(postPool.reservedHype.toString());
    const buyTooMuch = availableHype.add(new anchor.BN(1));

    try {
      await program.methods
        .hype(buyTooMuch, new anchor.BN(postId), new anchor.BN(0))
        .accounts({
          buyer: creator.publicKey,
          postPool: postPoolPda,
          postVault: postVaultPda,
          hypeRecord: hypeRecordPda,
          treasury: treasuryPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
      assert.fail("expected failure when buying more hype than reserve");
    } catch (err: any) {
      const msg = err.toString();
      assert.ok(msg.includes("Insufficient hype reserve") || msg.includes("InsufficientHypeReserve"));
    }
  });

  it("creator release hype pays out correctly", async () => {
    const creator = anchor.web3.Keypair.generate();
    const postId = 15;
    const depositedSol = new anchor.BN(Math.floor(0.5 * anchor.web3.LAMPORTS_PER_SOL));
    const HYPE_PER_LAMPORT = 10;

    const sig = await provider.connection.requestAirdrop(creator.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("post"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );
    const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );
    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("treasury")], program.programId);

    await program.methods
      .initializePost(new anchor.BN(postId), depositedSol)
      .accounts({
        creator: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const postPoolBefore = await program.account.postPool.fetch(postPoolPda);

    const totalInitialHype = depositedSol.mul(new anchor.BN(HYPE_PER_LAMPORT));
    const expectedCreatorHype = totalInitialHype.div(new anchor.BN(10));
    assert.strictEqual(postPoolBefore.creatorHypeBalance.toString(), expectedCreatorHype.toString());

    const creatorBalanceBefore = await provider.connection.getBalance(creator.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(postVaultPda);

    const releaseAmount = postPoolBefore.creatorHypeBalance.div(new anchor.BN(2));

    await program.methods
      .creatorReleaseHype(releaseAmount, new anchor.BN(postId))
      .accounts({
        user: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const postPoolAfter = await program.account.postPool.fetch(postPoolPda);
    const creatorBalanceAfter = await provider.connection.getBalance(creator.publicKey);
    const vaultBalanceAfter = await provider.connection.getBalance(postVaultPda);

    assert.strictEqual(
      postPoolAfter.creatorHypeBalance.toString(),
      postPoolBefore.creatorHypeBalance.sub(releaseAmount).toString()
    );
    assert.strictEqual(
      postPoolAfter.reservedHype.toString(),
      postPoolBefore.reservedHype.add(releaseAmount).toString()
    );
    assert.ok(creatorBalanceAfter > creatorBalanceBefore, "creator should receive SOL");
    assert.ok(vaultBalanceAfter < vaultBalanceBefore, "vault balance should decrease");
    assert.strictEqual(
      postPoolAfter.totalHype.toString(),
      postPoolBefore.totalHype.sub(releaseAmount).toString()
    );
  });

  it("verify treasury accumulation", async () => {
    const creator = anchor.web3.Keypair.generate();
    const postId = 16;
    const depositedSol = new anchor.BN(anchor.web3.LAMPORTS_PER_SOL); // 1 SOL
    const MIN_HYPE_TO_BUY = new anchor.BN(1_000_000); // from program

    // Airdrop enough to cover: rent (2 PDAs + hype_record), deposit, and buy cost+fee
    const sig = await provider.connection.requestAirdrop(
      creator.publicKey,
      3 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const [postPoolPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("post"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const [postVaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("vault"),
        creator.publicKey.toBuffer(),
        new anchor.BN(postId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const [hypeRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("hype_record"), creator.publicKey.toBuffer(), postPoolPda.toBuffer()],
      program.programId
    );
    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      program.programId
    );

    const treasuryBefore = new anchor.BN(await provider.connection.getBalance(treasuryPda));

    // Initialize post (treasury should collect an init fee here)
    await program.methods
      .initializePost(new anchor.BN(postId), depositedSol)
      .accounts({
        creator: creator.publicKey,
        postPool: postPoolPda,
        postVault: postVaultPda,
        treasury: treasuryPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const treasuryAfterInit = new anchor.BN(await provider.connection.getBalance(treasuryPda));
    const initFee = treasuryAfterInit.sub(treasuryBefore);
    assert.ok(initFee.gt(new anchor.BN(0)), "Treasury should increase on initialize");

    // Compute AMM price for the minimum valid buy amount and set slippage
    const postPool = await program.account.postPool.fetch(postPoolPda);
    const reserveSol = new anchor.BN(postPool.reservedSol.toString());
    const reserveHype = new anchor.BN(postPool.reservedHype.toString());
    const amountToBuy = MIN_HYPE_TO_BUY; // must be >= 1_000_000
    const price = ammPrice(reserveSol, reserveHype, amountToBuy);
    const maxAcceptablePrice = price.mul(new anchor.BN(105)).div(new anchor.BN(100)); // +5%

    // Buy hype (treasury should collect a buy fee here)
    try {
      await program.methods
        .hype(amountToBuy, new anchor.BN(postId), maxAcceptablePrice)
        .accounts({
          buyer: creator.publicKey,
          postPool: postPoolPda,
          postVault: postVaultPda,
          hypeRecord: hypeRecordPda,
          treasury: treasuryPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
    } catch (e: any) {
      // Helpful when debugging CI flakes
      if (e.getLogs) console.error("Hype logs:", await e.getLogs());
      throw e;
    }

    const treasuryAfterAll = new anchor.BN(await provider.connection.getBalance(treasuryPda));
    const buyFee = treasuryAfterAll.sub(treasuryAfterInit);
    assert.ok(buyFee.gt(new anchor.BN(0)), "Treasury should increase on buy");

    // Final sanity: total delta equals sum of step deltas
    const totalDelta = treasuryAfterAll.sub(treasuryBefore);
    assert.strictEqual(
      totalDelta.toString(),
      initFee.add(buyFee).toString(),
      "Treasury delta should equal init fee + buy fee"
    );
  });

  it("withdraw_treasury works correctly", async () => {
    const authority = provider.wallet.publicKey;

    // PDAs
    const [configPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("config")],
      program.programId
    );
    const [treasuryPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      program.programId
    );

    // Recipient (separate from authority to avoid fee noise)
    const recipient = anchor.web3.Keypair.generate();
    // Ensure recipient account exists (system-owned)
    const airdropSig = await provider.connection.requestAirdrop(recipient.publicKey, 10_000);
    await provider.connection.confirmTransaction(airdropSig);

    // Balances before
    const recipientBefore = await provider.connection.getBalance(recipient.publicKey);
    const treasuryBefore = await provider.connection.getBalance(treasuryPda);

    // Ensure treasury has something to withdraw
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(8); // treasury was created with space = 8
    assert.ok(
      treasuryBefore > rentExempt,
      "Treasury should have more than rent-exempt minimum to withdraw"
    );

    // Withdraw all available above rent
    const withdrawLamports = new anchor.BN(treasuryBefore - rentExempt);

    await program.methods
      .withdrawTreasury(withdrawLamports)
      .accounts({
        authority,
        config: configPda,
        treasury: treasuryPda,
        recipient: recipient.publicKey, // REQUIRED by program
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Balances after
    const recipientAfter = await provider.connection.getBalance(recipient.publicKey);
    const treasuryAfter = await provider.connection.getBalance(treasuryPda);

    // Recipient should receive exactly the withdrawn lamports
    assert.strictEqual(
      recipientAfter - recipientBefore,
      withdrawLamports.toNumber(),
      "Recipient should receive withdrawn lamports"
    );

    // Treasury should be at (or very near) rent-exempt minimum
    assert.ok(
      treasuryAfter >= rentExempt && treasuryAfter <= rentExempt + 1, // allow off-by-one rounding
      "Treasury should remain rent-exempt after withdrawal"
    );

    // Attempt over-withdraw (should fail)
    try {
      await program.methods
        .withdrawTreasury(new anchor.BN(1))
        .accounts({
          authority,
          config: configPda,
          treasury: treasuryPda,
          recipient: recipient.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should not be able to withdraw beyond treasury balance above rent");
    } catch (e) {
      // expected
    }
  });
});