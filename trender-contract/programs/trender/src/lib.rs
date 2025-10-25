use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    system_instruction,
    program::{invoke, invoke_signed},
};
use std::str::FromStr;

declare_id!("9ZFKHrBrA2YC19eLvuCM4kjabjXFqphYJs8PxgeeSG7S");

const MIN_SOL_DEPOSIT: u128 = 1_000_000; // 0.001 SOL
const MIN_HYPE_TO_BUY: u128 = 1_000_000; // 1 HYPE
const MIN_HYPE_TO_SELL: u128 = 1_000_000; // 1 HYPE
const HYPE_PER_LAMPORT: u128 = 10;


#[program]
pub mod trender {
    use super::*;

    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.payer.key();
        cfg.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn initialize_post(ctx: Context<InitializePost>, post_id: u64, deposited_sol: u128) -> Result<()> {
        require!(deposited_sol > 0, TrenderError::InvalidDepositAmount);

        let deposited_sol_u64: u64 = deposited_sol.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;

        // 2% fee on initial deposit
        let fee = deposited_sol.checked_mul(2).unwrap().checked_div(100).unwrap();
        let fee_u64: u64 = fee.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;

        // Transfer SOL from creator to the post pool vault PDA
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.post_vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, deposited_sol_u64)?;

        // Transfer fee to treasury
        let ix2 = system_instruction::transfer(
            &ctx.accounts.creator.key(),
            &ctx.accounts.treasury.key(),
            fee_u64.try_into().unwrap(),
        );
        invoke(
            &ix2,
            &[
                ctx.accounts.creator.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ]
        )?;


        let post_pool = &mut ctx.accounts.post_pool;
        post_pool.creator = ctx.accounts.creator.key();
        post_pool.post_id = post_id;
        // record the vault pubkey so seeds/addresses don't have to be assumed elsewhere
        post_pool.vault = ctx.accounts.post_vault.key();
        post_pool.reserved_sol = deposited_sol;
        post_pool.reserved_hype = deposited_sol.checked_mul(HYPE_PER_LAMPORT).unwrap();
        // Creator gets 10% if initial hype supply
        post_pool.creator_hype_balance = post_pool.reserved_hype.checked_div(10).unwrap();
        post_pool.total_hype = post_pool.creator_hype_balance;
        post_pool.bump = ctx.bumps.post_pool;
        post_pool.vault_bump = ctx.bumps.post_vault;

        Ok(())
    }

    pub fn hype(ctx: Context<HypePost>, amount: u128, post_id: u64, max_acceptable_price: u128) -> Result<()> { // amount --> amount of hype to buy
        let hype_record = &mut ctx.accounts.hype_record;

        require!(amount > 0, TrenderError::InvalidHypeAmount);
        require!(amount >= MIN_HYPE_TO_BUY, TrenderError::InvalidHypeAmount);
        require!(ctx.accounts.post_pool.reserved_hype >= amount, TrenderError::InsufficientHypeReserve);
        
        let reserved_sol = ctx.accounts.post_pool.reserved_sol;
        let reserved_hype = ctx.accounts.post_pool.reserved_hype;
        let price = amm_price(reserved_sol, reserved_hype, amount)?;
        // Make sure the price is within the user's slippage tolerance
        require!(price <= max_acceptable_price, TrenderError::SlippageExceeded);
        let price_u64: u64 = price.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;
        
        // 0.5% fee on hype purchase
        let fee = price.checked_mul(5).unwrap().checked_div(1000).unwrap();
        let fee_u64: u64 = fee.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;

        // Transfer SOL from buyer to post pool vault PDA
        let ix1 = system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.post_vault.key(),
            price_u64,
        );
        let ix2 = system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.treasury.key(),
            fee_u64.try_into().unwrap(),
        );
        invoke(
            &ix1,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.post_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        invoke(
            &ix2,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ]
        )?;

        let post_pool = &mut ctx.accounts.post_pool;
        post_pool.reserved_sol = post_pool.reserved_sol.checked_add(price).unwrap();
        post_pool.reserved_hype = post_pool.reserved_hype.checked_sub(amount).unwrap();
        post_pool.total_hype = post_pool.total_hype.checked_add(amount).unwrap();

        hype_record.user = ctx.accounts.buyer.key();
        hype_record.post_pool = post_pool.to_account_info().key();
        hype_record.amount = amount;
        hype_record.bump = ctx.bumps.hype_record;

        let amount_u64: u64 = amount.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;
        let price_per_unit = price.checked_div(amount).unwrap();
        let price_per_unit_u64: u64 = price_per_unit.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;
        let total_cost_u64: u64 = price.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;

        emit!(HypeEvent {
            post_id: post_id,
            user: ctx.accounts.buyer.key(),
            amount: amount_u64,
            price: price_per_unit_u64,
            total_cost: total_cost_u64,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn unhype(ctx: Context<UnhypePost>, amount: u128, post_id: u64, min_acceptable_refund: u128) -> Result<()> {
        let hype_record = &mut ctx.accounts.hype_record;

        require!(hype_record.user == ctx.accounts.user.key(), TrenderError::Unauthorized);
        require!(amount > 0, TrenderError::InvalidHypeAmount);
        require!(amount >= MIN_HYPE_TO_SELL, TrenderError::InvalidHypeAmount);
        require!(hype_record.amount >= amount, TrenderError::InsufficientHypeBalance);

        let reserved_sol = ctx.accounts.post_pool.reserved_sol;
        let reserved_hype = ctx.accounts.post_pool.reserved_hype;

        let refund = amm_refund(reserved_sol, reserved_hype, amount)?;
        require!(reserved_sol >= refund, TrenderError::InsufficientSolReserve);
        let refund_u64: u64 = refund.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;

        // Make sure the refund is within the user's slippage tolerance
        require!(refund >= min_acceptable_refund, TrenderError::SlippageExceeded);

        // 0.5% fee on unhype refund
        let fee = refund.checked_mul(5).unwrap().checked_div(1000).unwrap();
        let fee_u64: u64 = fee.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;
        let after_fee_refund = refund.checked_sub(fee).unwrap();
        let after_fee_refund_u64: u64 = after_fee_refund.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;

        let vault = &mut ctx.accounts.post_vault;
        let receiver = &mut ctx.accounts.user;
        let _treasury = &mut ctx.accounts.treasury;

        // Safety: both are valid AccountInfos
        **vault.to_account_info().try_borrow_mut_lamports()? -= after_fee_refund_u64;
        **receiver.to_account_info().try_borrow_mut_lamports()? += after_fee_refund_u64;

        **vault.to_account_info().try_borrow_mut_lamports()? -= fee_u64;
        **_treasury.to_account_info().try_borrow_mut_lamports()? += fee_u64;

        let post_pool = &mut ctx.accounts.post_pool;
        post_pool.reserved_sol = post_pool.reserved_sol.checked_sub(refund).unwrap();
        post_pool.reserved_hype = post_pool.reserved_hype.checked_add(amount).unwrap();
        post_pool.total_hype = post_pool.total_hype.checked_sub(amount).unwrap();

        hype_record.amount = hype_record.amount.checked_sub(amount).unwrap();

        let amount_u64: u64 = amount.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;
        let price_per_unit = refund.checked_div(amount).unwrap();
        let price_per_unit_u64: u64 = price_per_unit.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;
        let total_refund_u64: u64 = refund.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;

        emit!(UnhypeEvent {
            post_id: post_id,
            user: ctx.accounts.user.key(),
            amount: amount_u64,
            price: price_per_unit_u64,
            total_refund: total_refund_u64,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn creator_release_hype(ctx: Context<CreatorRelaseHype>, amount: u128, post_id: u64) -> Result<()> {
        require!(ctx.accounts.user.key() == ctx.accounts.post_pool.creator, TrenderError::Unauthorized);
        require!(amount > 0, TrenderError::InvalidHypeAmount);
        require!(ctx.accounts.post_pool.creator_hype_balance >= amount, TrenderError::InsufficientHypeBalance);

        let amount_u64: u64 = amount.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;
        
        // Calculate price using the AMM formula
        let creator_refund = amm_price(
            ctx.accounts.post_pool.reserved_sol,
            ctx.accounts.post_pool.reserved_hype,
            amount
        )?;
        
        let creator_refund_u64: u64 = creator_refund.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;
        require!(ctx.accounts.post_pool.reserved_sol >= creator_refund, TrenderError::InsufficientSolReserve);

        let vault = &mut ctx.accounts.post_vault;
        let receiver = &mut ctx.accounts.user;

        // Transfer SOL from vault to creator
        **vault.to_account_info().try_borrow_mut_lamports()? -= creator_refund_u64;
        **receiver.to_account_info().try_borrow_mut_lamports()? += creator_refund_u64;

        let post_pool = &mut ctx.accounts.post_pool;

        // Update the pool state
        post_pool.creator_hype_balance = post_pool.creator_hype_balance.checked_sub(amount).unwrap();
        post_pool.total_hype = post_pool.total_hype.checked_sub(amount).unwrap();
        post_pool.reserved_sol = post_pool.reserved_sol.checked_sub(creator_refund).unwrap();
        // The hype goes into the pool's reserve
        post_pool.reserved_hype = post_pool.reserved_hype.checked_add(amount).unwrap();

        let price_per_unit = creator_refund.checked_div(amount).unwrap();
        let price_per_unit_u64: u64 = price_per_unit.try_into().map_err(|_| error!(TrenderError::AmountTooLarge))?;

        emit!(UnhypeEvent {
            post_id: post_id,
            user: ctx.accounts.user.key(),
            amount: amount_u64,
            price: price_per_unit_u64,
            total_refund: creator_refund_u64,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
        require!(ctx.accounts.config.admin == ctx.accounts.authority.key(), TrenderError::Unauthorized);

        let _treasury = &mut ctx.accounts.treasury;
        let recipient = &mut ctx.accounts.recipient;

        // Safety: both are valid AccountInfos
        **_treasury.to_account_info().try_borrow_mut_lamports()? -= amount;
        **recipient.to_account_info().try_borrow_mut_lamports()? += amount;

        Ok(())
    }
}

fn amm_price(reserved_sol: u128, reserved_hype: u128, hype_bought: u128) -> Result<u128> {
    let k = reserved_sol.checked_mul(reserved_hype).unwrap();
    let new_reserved_hype = reserved_hype.checked_sub(hype_bought).unwrap();
    let new_reserved_sol = k.checked_div(new_reserved_hype).unwrap();
    let price = new_reserved_sol.checked_sub(reserved_sol).unwrap();

    Ok(price)
}

fn amm_refund(reserved_sol: u128, reserved_hype: u128, hype_sold: u128) -> Result<u128> {
    let k = reserved_sol.checked_mul(reserved_hype).unwrap();
    let new_reserved_hype = reserved_hype.checked_add(hype_sold).unwrap();
    let new_reserved_sol = k.checked_div(new_reserved_hype).unwrap();
    let refund = reserved_sol.checked_sub(new_reserved_sol).unwrap();

    Ok(refund)
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(init, payer = payer, space = 8 + 32 + 1, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    /// CHECK: Treasury PDA used to collect protocol fees. It's a PDA derived with seeds = ["treasury"] and owned by the system program; no runtime checks needed here.
    #[account(init, payer = payer, seeds = [b"treasury"], bump, space = 8)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(post_id: u64, deposited_sol: u128)]
pub struct InitializePost<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + PostPool::MAX_SIZE,
        seeds = [b"post", creator.key().as_ref(), &post_id.to_le_bytes()],
        bump
    )]
    pub post_pool: Account<'info, PostPool>,

    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"vault", creator.key().as_ref(), &post_id.to_le_bytes()],
        bump
    )]
    pub post_vault: Account<'info, PostVault>,

    /// CHECK: Treasury PDA used to collect fees from initial deposit; validated by seeds/bump on the account.
    #[account(mut, seeds = [b"treasury"], bump)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u128, post_id: u64, max_acceptable_price: u128)]
pub struct HypePost<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut, seeds = [b"post", post_pool.creator.as_ref(), &post_pool.post_id.to_le_bytes()], bump = post_pool.bump)]
    pub post_pool: Account<'info, PostPool>,

    /// CHECK: vault PDA must be owned by program
    #[account(mut, seeds = [b"vault", post_pool.creator.as_ref(), &post_pool.post_id.to_le_bytes()], bump = post_pool.vault_bump)]
    pub post_vault: Account<'info, PostVault>,

    #[account(init, payer = buyer, space = 8 + HypeRecord::MAX_SIZE, seeds = [b"hype_record", buyer.key().as_ref(), post_pool.key().as_ref()], bump)]
    pub hype_record: Account<'info, HypeRecord>,

    /// CHECK: Treasury PDA used to receive purchase fees.
    #[account(mut, seeds = [b"treasury"], bump)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(amount: u128, post_id: u64, min_acceptable_refund: u128)]
pub struct UnhypePost<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"post", post_pool.creator.as_ref(), &post_pool.post_id.to_le_bytes()], bump = post_pool.bump)]
    pub post_pool: Account<'info, PostPool>,

    /// CHECK: vault PDA must be owned by program
    #[account(mut, seeds = [b"vault", post_pool.creator.as_ref(), &post_pool.post_id.to_le_bytes()], bump = post_pool.vault_bump)]
    pub post_vault: Account<'info, PostVault>,

    #[account(mut, seeds = [b"hype_record", user.key().as_ref(), post_pool.key().as_ref()], bump = hype_record.bump, has_one = user)]
    pub hype_record: Account<'info, HypeRecord>,

    /// CHECK: Treasury PDA used to receive fees from vault via signed CPI.
    #[account(mut, seeds = [b"treasury"], bump)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(amount: u128, post_id: u64)]
pub struct CreatorRelaseHype<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"post", post_pool.creator.as_ref(), &post_pool.post_id.to_le_bytes()], bump = post_pool.bump)]
    pub post_pool: Account<'info, PostPool>,

    
    #[account(mut)]
    pub post_vault: Account<'info, PostVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawTreasury<'info> {
    pub authority: Signer<'info>,

    /// CHECK: Treasury PDA that holds collected fees; validated via seeds/bump on this account.
    #[account(mut, seeds = [b"treasury"], bump)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: The recipient account is assumed to be valid for fund transfers.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub bump: u8,
}

#[account]
pub struct PostPool {
    pub creator: Pubkey,
    pub creator_hype_balance: u128,
    pub post_id: u64,
    pub vault: Pubkey,
    pub reserved_sol: u128,
    pub reserved_hype: u128,
    pub total_hype: u128,
    pub bump: u8,
    pub vault_bump: u8
}

#[account]
pub struct HypeRecord {
    pub user: Pubkey,
    pub post_pool: Pubkey,
    pub amount: u128,
    pub bump: u8,
}

#[account]
pub struct PostVault {}

#[event]
pub struct HypeEvent {
    pub post_id: u64,
    pub user: Pubkey,
    pub amount: u64,
    pub price: u64,
    pub total_cost: u64,
    pub timestamp: i64,
}

#[event]
pub struct UnhypeEvent {
    pub post_id: u64,
    pub user: Pubkey,
    pub amount: u64,
    pub price: u64,
    pub total_refund: u64,
    pub timestamp: i64,
}

impl PostPool {
    pub const MAX_SIZE: usize = 32  // creator (Pubkey)
        + 16  // creator_hype_balance (u128)
        + 8   // post_id (u64)
        + 32  // vault (Pubkey)
        + 16  // reserved_sol (u128)
        + 16  // reserved_hype (u128)
        + 16  // total_hype (u128)
        + 1   // bump (u8)
        + 1;  // vault_bump (u8)
}

impl HypeRecord {
    pub const MAX_SIZE: usize = 32
        + 32
        + 16
        + 1;
}

#[error_code]
pub enum TrenderError {
    #[msg("Invalid deposit amount.")]
    InvalidDepositAmount,
    #[msg("Invalid hype amount.")]
    InvalidHypeAmount,
    #[msg("Insufficient hype reserve in the post pool.")]
    InsufficientHypeReserve,
    #[msg("Unauthorized action.")]
    Unauthorized,
    #[msg("Insufficient hype balance.")]
    InsufficientHypeBalance,
    #[msg("Insufficient SOL reserve in the post pool.")]
    InsufficientSolReserve,
    #[msg("Amount exceeds maximum allowed value")]
    AmountTooLarge,
    #[msg("SlippageExceeded for the transaction.")]
    SlippageExceeded,
    #[msg("Insufficient funds to complete the transaction.")]
    InsufficientFunds,
}
