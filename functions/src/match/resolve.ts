import {
  AnchorProvider,
  Program,
  setProvider,
  web3,
} from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { fs, SOLANA_URL } from "../contants";
import { IDL, NftBazzar } from "../target/types/nft_bazzar";
import { IMatch, INFT, MatchStates } from "./states";
import idl from "../target/idl/nft_bazzar.json";
import { getATAInstructionAndAddress } from "./assign";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface IResolveGame {
  winner_key: string;
  match_id: string;
}

export interface PlayerBet {
  playerAuthority: PublicKey;
  playerAta: PublicKey;
  playerMintKey: PublicKey;
  arbiterAta: PublicKey;
  winnerAta: PublicKey;
}

export const resolveGame = async (payload: IResolveGame) => {
  if (process.env.SOLANA_WALLET === undefined) {
    throw `SOLANA_WALLET is undefined`;
  }
  try {
    const matchesCollection = fs.collection("matches");
    const nftsCollection = fs.collection("nfts");

    const doc = await matchesCollection.doc(payload.match_id).get();
    if (!doc.exists) {
      throw `undefined match ${payload.match_id}`;
    }

    const match = doc.data() as IMatch;
    if (match.state !== MatchStates.Finished) {
      throw `wrong match state`;
    }
    const agreementId = new web3.PublicKey(match.agreement_id!);
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

    const accountData = await program.account.game.fetch(
      new web3.PublicKey(accountKey.toBase58())
    );

    const owners = accountData.bets as PlayerBet[];

    const winnerKey = new PublicKey(payload.winner_key);

    const setWinner = await program.methods
      .setWinner()
      .accounts({
        game: accountKey,
        winner: winnerKey,
        arbiter: wallet.publicKey,
      })
      .instruction();
    const instructions = [setWinner];

    const winnerKeys: { [key: string]: PublicKey } = {};
    await owners.reduce(async (acc, o) => {
      await acc;
      const [ataB, ataCreateB] = await getATAInstructionAndAddress(
        provider,
        winnerKey,
        wallet.publicKey,
        o.playerMintKey
      );
      if (ataCreateB) {
        instructions.push(ataCreateB);
      }
      const setWinnerAta = await program.methods
        .setWinnerAccount()
        .accounts({
          game: accountKey,
          winnerAssociatedToken: ataB,
          trophy: o.playerMintKey,
          arbiter: wallet.publicKey,
        })
        .instruction();

      instructions.push(setWinnerAta);
      winnerKeys[o.playerMintKey.toBase58()] = ataB;
      return Promise.resolve();
    }, Promise.resolve());

    const game = await program.account.game.fetch(accountKey);
    const bets = game.bets as PlayerBet[];

    const dropInstr = await program.methods
      .dropLoot()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        game: accountKey,
        agreement: agreementId,
        arbiter: wallet.publicKey,
      })
      .remainingAccounts(
        bets
          .map((o) => ({
            pubkey: o.arbiterAta,
            isWritable: true,
            isSigner: false,
          }))
          .concat(
            bets.map((o) => ({
              pubkey: winnerKeys[o.playerMintKey.toBase58()],
              isWritable: true,
              isSigner: false,
            }))
          )
      )
      .instruction();
    instructions.push(dropInstr);
    const tx = new web3.Transaction();
    tx.add(...instructions);
    await provider.sendAndConfirm(tx, [wallet.payer], {
      skipPreflight: true,
    });

    const accountData2 = await program.account.game.fetch(accountKey);
    const owners3 = accountData2.bets as PlayerBet[];

    const mintKeys = owners3.map((o) => o.playerMintKey.toBase58());
    const snapshot = await nftsCollection
      .where("mint_key", "in", mintKeys)
      .get();
    const mintMap = snapshot.docs.reduce<{
      [key: string]: INFT & { id: string };
    }>((acc, doc) => {
      const nft = doc.data() as INFT;
      const id = doc.id;
      acc[nft.mint_key] = { id, ...nft };
      return acc;
    }, {});
    const batch = fs.batch();
    owners3.forEach(async (o) => {
      const nft = mintMap[o.playerMintKey.toBase58()];
      const docRef = nftsCollection.doc(nft.id);
      batch.update(docRef, {
        owner: accountData2.winner.toBase58(),
        account_id: o.winnerAta.toBase58(),
      });
    });
    await batch.commit();
    await matchesCollection.doc(payload.match_id).update({
      winner_key: winnerKey.toBase58(),
      state: MatchStates.LootResolved,
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
};
