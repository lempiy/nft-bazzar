import {
  AnchorProvider,
  Program,
  setProvider,
  web3,
} from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { IDL, NftBazzar } from "../target/types/nft_bazzar";
import idl from "../target/idl/nft_bazzar.json";
import { fs, SOLANA_URL } from "../contants";
import { IMatch, MatchStates, PlayerBet } from "./states";
import { createAgreement } from "./agreement";

export interface IAssignPayload {
  is_player_one: boolean;
  from_ata_key: string;
  match_id: string;
  mint_key: string;
  owner_key: string;
}

export const getATAInstructionAndAddress = async (
  provider: AnchorProvider,
  owner: PublicKey,
  payer: PublicKey,
  mint: PublicKey
): Promise<[PublicKey, web3.TransactionInstruction?]> => {
  const account = await provider.connection.getTokenAccountsByOwner(owner, {
    mint: mint,
  });
  // The ATA for a token on the to wallet (but might not exist yet)
  return account.value.length
    ? [account.value[0].pubkey]
    : await createNewATAInstruction(payer, owner, mint);
};

export const assign = async (payload: IAssignPayload) => {
  if (process.env.SOLANA_WALLET === undefined) {
    throw `SOLANA_WALLET is undefined`;
  }
  try {
    const matchesCollection = fs.collection("matches");
    const doc = await matchesCollection.doc(payload.match_id).get();
    if (!doc.exists) {
      throw `undefined match ${payload.match_id}`;
    }


    const match = doc.data() as IMatch;
    if (match.state !== MatchStates.AccountReady) {
      throw `wrong match state`;
    }
    const options = AnchorProvider.defaultOptions();
    const connection = new Connection(SOLANA_URL, options.commitment);
    const payer = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.SOLANA_WALLET))
    );

    const wallet = new NodeWallet(payer);
    const provider = new AnchorProvider(connection, wallet, options);
    setProvider(provider);
    const program = new Program(
      IDL,
      idl.metadata.address,
      provider!
    ) as Program<NftBazzar>;

    const accountKey = new PublicKey(match.account_key!);



    const mintKey = new PublicKey(payload.mint_key);

    const playerAta = new PublicKey(payload.from_ata_key);
    const playerAuthority = new PublicKey(payload.owner_key);

    const [ataA, ataCreateA] = await getATAInstructionAndAddress(
      provider,
      wallet.publicKey,
      wallet.publicKey,
      mintKey
    );
    const instructions = ataCreateA ? [ataCreateA] : [];

    await program.methods
      .addBet()
      .accounts({
        arbiter: wallet.publicKey,
        game: accountKey,
        arbiterAta: ataA,
        playerAta: playerAta,
        playerAuthority: playerAuthority,
        playerMint: mintKey,
      })
      .preInstructions(instructions)
      .rpc();
    let gameAccount = await program.account.game.fetch(accountKey);

    const key =
      (gameAccount.bets as unknown[]).length == 1 ? "player_one" : "player_two";
    const playerBet: PlayerBet = {
      player_ata: playerAta.toBase58(),
      player_authority: playerAuthority.toBase58(),
      player_mint_key: mintKey.toBase58(),
      arbiter_ata: ataA.toBase58(),
    };
    await matchesCollection.doc(payload.match_id).update({
      game_id: accountKey.toBase58(),
      [key]: playerBet,
    });
    // making it in one for test
    if ("player_two" == key) {
      await createAgreement({ match_id: payload.match_id });
    }
  } catch (e) {
    console.error(e);
    throw e
  }
};

const createNewATAInstruction = async (
  payer: PublicKey,
  toWallet: PublicKey,
  mintKey: PublicKey
): Promise<[PublicKey, web3.TransactionInstruction]> => {
  const toATA = await getAssociatedTokenAddress(mintKey, toWallet);
  return [
    toATA,
    createAssociatedTokenAccountInstruction(payer, toATA, toWallet, mintKey),
  ];
};
