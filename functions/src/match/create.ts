import { Program, Wallet } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { NftBazzar } from "../target/types/nft_bazzar";

export async function createMatchAccount(
  program: Program<NftBazzar>,
  wallet: Wallet
): Promise<PublicKey> {
  const currentWallet = wallet.publicKey;
  const gameAccountSize = 1000; // Big enough.
  const gameAccount = Keypair.generate();
  await program.methods
    .createGame()
    .accounts({
      game: gameAccount.publicKey,
      arbiter: currentWallet,
    })
    .preInstructions([
      await program.account.game.createInstruction(
        gameAccount,
        gameAccountSize
      ),
    ])
    .signers([gameAccount])
    .rpc();
  return gameAccount.publicKey;
}
