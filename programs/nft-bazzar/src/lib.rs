use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_error::ProgramError as PE;
use anchor_spl::token;
use anchor_spl::token::{Approve, Mint, MintTo, Token, TokenAccount, Transfer};
use mpl_token_metadata::instruction::{create_master_edition_v3, create_metadata_accounts_v2};

use std::convert::Into;
use std::ops::Deref;

declare_id!("7GCSd3CwKCkdwRds5eHNDe6zasKSk8P4i5Svo61obhix");

#[program]
pub mod nft_bazzar {
    use super::*;
    use crate::constants::ARBITER_WALLET_KEY;

    pub fn mint_nft(
        ctx: Context<MintNFT>,
        creator_key: Pubkey,
        uri: String,
        title: String,
        symbol: String,
    ) -> Result<()> {
        msg!("Initializing Mint Ticket");
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        msg!("CPI Accounts Assigned");
        let cpi_program = ctx.accounts.token_program.to_account_info();
        msg!("CPI Program Assigned");
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        msg!("CPI Context Assigned");
        token::mint_to(cpi_ctx, 1)?;
        msg!("Token Minted !!!");
        let account_info = vec![
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.token_metadata_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        msg!("Account Info Assigned");
        let creator = vec![
            mpl_token_metadata::state::Creator {
                address: creator_key,
                verified: false,
                share: 100,
            },
            mpl_token_metadata::state::Creator {
                address: ctx.accounts.mint_authority.key(),
                verified: false,
                share: 0,
            },
        ];
        msg!("Creator Assigned");
        invoke(
            &create_metadata_accounts_v2(
                ctx.accounts.token_metadata_program.key(),
                ctx.accounts.metadata.key(),
                ctx.accounts.mint.key(),
                ctx.accounts.mint_authority.key(),
                ctx.accounts.payer.key(),
                ctx.accounts.payer.key(),
                title,
                symbol,
                uri,
                Some(creator),
                1,
                true,
                false,
                None,
                None,
            ),
            account_info.as_slice(),
        )?;
        msg!("Metadata Account Created !!!");
        let master_edition_infos = vec![
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.token_metadata_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        msg!("Master Edition Account Infos Assigned");
        invoke(
            &create_master_edition_v3(
                ctx.accounts.token_metadata_program.key(),
                ctx.accounts.master_edition.key(),
                ctx.accounts.mint.key(),
                ctx.accounts.payer.key(),
                ctx.accounts.mint_authority.key(),
                ctx.accounts.metadata.key(),
                ctx.accounts.payer.key(),
                Some(0),
            ),
            master_edition_infos.as_slice(),
        )?;
        msg!("Master Edition Nft Minted !!!");

        Ok(())
    }

    pub fn transfer_token(ctx: Context<TransferToken>) -> Result<()> {
        // Create the Transfer struct for our context
        let transfer_instruction = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.from_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        // Create the Context for our Transfer request
        let cpi_ctx = CpiContext::new(cpi_program, transfer_instruction);

        // Execute anchor's helper function to transfer tokens
        token::transfer(cpi_ctx, 1)?;

        Ok(())
    }

    // Initializes a new game account with empty set of bets.
    pub fn create_game(ctx: Context<CreateGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.arbiter = ctx.accounts.arbiter.key();
        game.bets = vec![];
        Ok(())
    }

    pub fn add_bet(ctx: Context<ChangeBets>) -> Result<()> {
        let new_bet = PlayerBet {
            player_authority: ctx.accounts.player_authority.key(),
            player_ata: ctx.accounts.player_ata.key(),
            player_mint_key: ctx.accounts.player_mint.key(),
            arbiter_ata: ctx.accounts.arbiter_ata.key(),
            winner_ata: None,
        };
        let game = &mut ctx.accounts.game;
        require!(
            game.bets
                .iter()
                .find(|bet| { bet.player_authority == new_bet.player_authority })
                .is_none(),
            UniqueBets
        );
        game.bets.push(new_bet);
        Ok(())
    }

    // Creates a new agreement account, signed by arbiter,
    // which must be arbiter from game.
    pub fn create_agreement(ctx: Context<CreateAgreement>) -> Result<()> {
        let mut signers = Vec::new();
        signers.resize(ctx.accounts.game.bets.len(), false);

        let agreement = &mut ctx.accounts.agreement;
        agreement.signers = signers;
        agreement.did_execute = false;
        agreement.game = ctx.accounts.game.key();
        Ok(())
    }

    // Approves an agreement on behalf of an player of the game.
    pub fn approve_agreement(ctx: Context<ApproveAgreement>) -> Result<()> {
        let player_index = ctx
            .accounts
            .game
            .bets
            .iter()
            .position(|a| a.player_authority == *ctx.accounts.authority.key)
            .ok_or(ErrorCode::InvalidPlayer)?;
        let approve_instruction_accounts = Approve {
            to: ctx.accounts.to.to_account_info(),
            delegate: ctx.accounts.arbiter.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        // Create the Context for our Transfer request
        let cpi_ctx = CpiContext::new(cpi_program, approve_instruction_accounts);

        // Execute anchor's helper function to transfer tokens
        token::approve(cpi_ctx, 1)?;
        ctx.accounts.agreement.signers[player_index] = true;

        Ok(())
    }

    pub fn collect_loot<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, CollectLoot<'info>>,
    ) -> Result<()> {
        require!(
            ctx.accounts.game.bets.len()
                == ctx
                    .accounts
                    .agreement
                    .signers
                    .iter()
                    .filter(|&s| *s)
                    .count(),
            NotEnoughSigners
        );
        require!(
            ctx.accounts.game.bets.len() * 2 == ctx.remaining_accounts.len(),
            WrongRemainingAccounts
        );
        let cpi_program = &ctx.accounts.token_program;
        let info = ctx.accounts.arbiter.to_account_info();
        let accounts = ctx.remaining_accounts;
        ctx.accounts.trigger(cpi_program, info, accounts)?;
        ctx.accounts.agreement.did_execute = true;
        Ok(())
    }

    pub fn set_winner(ctx: Context<SetWinner>) -> Result<()> {
        require!(
            ctx.accounts.game.winner == Pubkey::default(),
            AlreadyExecuted
        );
        require!(
            ctx.accounts
                .game
                .bets
                .iter()
                .find(|&bet| bet.player_authority == *ctx.accounts.winner.key)
                .is_some(),
            InvalidPlayer
        );
        ctx.accounts.game.winner = ctx.accounts.winner.key.clone();
        Ok(())
    }

    pub fn set_winner_account(ctx: Context<SetWinnerAccount>) -> Result<()> {
        require!(
            ctx.accounts
                .game
                .bets
                .iter()
                .find(|bet| bet.player_mint_key == ctx.accounts.trophy.key())
                .is_some(),
            InvalidPlayer
        );
        let i = ctx
            .accounts
            .game
            .bets
            .iter()
            .enumerate()
            .find(|&(_, bet)| bet.player_mint_key == ctx.accounts.trophy.key())
            .unwrap()
            .0;
        msg!("{:?}", i);
        ctx.accounts.game.bets[i].winner_ata = Some(ctx.accounts.winner_associated_token.key());
        msg!("{:?}", ctx.accounts.game.bets[i]);
        Ok(())
    }

    pub fn drop_loot<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, DropLoot<'info>>,
    ) -> Result<()> {
        require!(ctx.accounts.agreement.did_execute, NotReady);
        require!(ctx.accounts.game.winner != Pubkey::default(), NotReady);
        require!(
            ctx.accounts
                .game
                .bets
                .iter()
                .all(|bet| bet.winner_ata.is_some()),
            NotReady
        );
        let cpi_program = &ctx.accounts.token_program;
        let info = ctx.accounts.arbiter.to_account_info();
        let accounts = ctx.remaining_accounts;
        ctx.accounts.trigger(cpi_program, info, accounts)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,
    // #[account(mut)]
    pub token_program: Program<'info, Token>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_metadata_program: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub payer: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub rent: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct TransferToken<'info> {
    pub token_program: Program<'info, Token>,
    /// CHECK: The associated token account that we are transferring the token from
    #[account(mut)]
    pub from: UncheckedAccount<'info>,
    /// CHECK: The associated token account that we are transferring the token to
    #[account(mut)]
    pub to: AccountInfo<'info>,
    // the authority of the from account
    pub from_authority: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PlayerBet {
    pub player_authority: Pubkey,
    pub player_ata: Pubkey,
    pub player_mint_key: Pubkey,
    pub arbiter_ata: Pubkey,
    pub winner_ata: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(zero, signer)]
    game: Box<Account<'info, Game>>,
    arbiter: Signer<'info>,
}

#[account]
pub struct Game {
    pub bets: Vec<PlayerBet>,
    pub arbiter: Pubkey,
    pub winner: Pubkey,
}

#[account]
pub struct Agreement {
    // The game account this agreement belongs to.
    pub game: Pubkey,
    // signers[index] is true iff game.bets[index] signed the agreement.
    pub signers: Vec<bool>,
    // Boolean ensuring one time execution.
    pub did_execute: bool,
}

#[derive(Accounts)]
pub struct ChangeBets<'info> {
    #[account(mut, has_one = arbiter)]
    game: Box<Account<'info, Game>>,
    #[account()]
    arbiter: Signer<'info>,
    /// CHECK: Using this acc to check key
    #[account()]
    player_authority: UncheckedAccount<'info>,
    #[account()]
    player_ata: Account<'info, TokenAccount>,
    // TODO: add constrains to validate authority
    #[account()]
    player_mint: Account<'info, Mint>,
    #[account()]
    arbiter_ata: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct CreateAgreement<'info> {
    #[account(has_one = arbiter)]
    game: Box<Account<'info, Game>>,
    #[account(zero, signer)]
    agreement: Box<Account<'info, Agreement>>,
    /// CHECK: Arbiter is signer
    arbiter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveAgreement<'info> {
    token_program: Program<'info, Token>,
    #[account()]
    game: Box<Account<'info, Game>>,
    /// CHECK: The associated token account that we are approve to use as source
    #[account(mut)]
    to: Account<'info, TokenAccount>,
    #[account(mut, has_one = game)]
    agreement: Box<Account<'info, Agreement>>,
    // One of the players. Checked in the handler.
    authority: Signer<'info>,
    /// CHECK: is ok
    #[account()]
    arbiter: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CollectLoot<'info> {
    token_program: Program<'info, Token>,
    #[account()]
    game: Box<Account<'info, Game>>,
    #[account(mut, has_one = game)]
    agreement: Box<Account<'info, Agreement>>,
    #[account()]
    arbiter: Signer<'info>,
}

impl<'info> CollectLoot<'info> {
    fn trigger(
        &self,
        cpi_program: &Program<'info, Token>,
        authority: AccountInfo<'info>,
        accounts: &[AccountInfo<'info>],
    ) -> Result<()> {
        for bet in self.game.bets.iter() {
            let from = accounts
                .into_iter()
                .find(|&acc| *acc.key == bet.player_ata)
                .ok_or(ErrorCode::WrongRemainingAccounts)?
                .to_account_info();
            let to = accounts
                .into_iter()
                .find(|&acc| *acc.key == bet.arbiter_ata)
                .ok_or(ErrorCode::WrongRemainingAccounts)?
                .to_account_info();

            let transfer_instruction = Transfer {
                from,
                to,
                authority: authority.to_account_info(),
            };
            // Create the Context for our Transfer request
            let cpi_ctx = CpiContext::new(cpi_program.to_account_info(), transfer_instruction);

            // Execute anchor's helper function to transfer tokens
            token::transfer(cpi_ctx, 1)?;
        }
        return Ok(());
    }
}

#[derive(Accounts)]
pub struct DropLoot<'info> {
    token_program: Program<'info, Token>,
    #[account()]
    game: Box<Account<'info, Game>>,
    #[account(mut, has_one = game)]
    agreement: Box<Account<'info, Agreement>>,
    #[account()]
    arbiter: Signer<'info>,
}

impl<'info> DropLoot<'info> {
    fn trigger(
        &self,
        cpi_program: &Program<'info, Token>,
        arbiter: AccountInfo<'info>,
        accounts: &[AccountInfo<'info>],
    ) -> Result<()> {
        for bet in self.game.bets.iter() {
            msg!("run {}", accounts.len());
            let from = accounts
                .into_iter()
                .find(|&acc| *acc.key == bet.arbiter_ata)
                .ok_or(ErrorCode::WrongRemainingAccounts)?
                .to_account_info();
            let to = accounts
                .into_iter()
                .find(|&acc| *acc.key == bet.winner_ata.unwrap())
                .ok_or(ErrorCode::WrongRemainingAccounts)?
                .to_account_info();

            let transfer_instruction = Transfer {
                from,
                to,
                authority: arbiter.to_account_info(),
            };
            msg!(
                "{:?} -> {:?}",
                transfer_instruction.from.key(),
                transfer_instruction.to.key()
            );
            msg!("{:?}", arbiter.key());
            // Create the Context for our Transfer request
            let cpi_ctx = CpiContext::new(cpi_program.to_account_info(), transfer_instruction);

            // Execute anchor's helper function to transfer tokens
            token::transfer(cpi_ctx, 1)?;
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SetWinner<'info> {
    #[account(mut, has_one = arbiter)]
    game: Box<Account<'info, Game>>,
    #[account()]
    /// CHECK: One of the players, checked in instruction
    winner: UncheckedAccount<'info>,
    /// CHECK: Arbiter is signer
    arbiter: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetWinnerAccount<'info> {
    #[account(mut, has_one = arbiter)]
    game: Box<Account<'info, Game>>,
    #[account(
        associated_token::mint = trophy,
        associated_token::authority = game.winner,
    )]
    winner_associated_token: Account<'info, TokenAccount>,
    #[account()]
    trophy: Account<'info, Mint>,
    /// CHECK: Arbiter is signer
    arbiter: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The given player is not part of this game.")]
    InvalidPlayer,
    #[msg("Owners length must be non zero.")]
    InvalidOwnersLen,
    #[msg("Not enough owners signed this transaction.")]
    NotEnoughSigners,
    #[msg("Cannot delete a transaction that has been signed by an owner.")]
    TransactionAlreadySigned,
    #[msg("Overflow when adding.")]
    Overflow,
    #[msg("Cannot delete a transaction the owner did not create.")]
    UnableToDelete,
    #[msg("The given transaction has already been executed.")]
    AlreadyExecuted,
    #[msg("Threshold must be less than or equal to the number of owners.")]
    InvalidThreshold,
    #[msg("Bets must be unique")]
    UniqueBets,
    #[msg("Wrong remaining accounts supplied")]
    WrongRemainingAccounts,
    #[msg("Not ready")]
    NotReady,
}
