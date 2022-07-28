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
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

interface IExecute {
  match_id: string;
}

export interface PlayerBet {
  playerAuthority: PublicKey;
  playerAta: PublicKey;
  playerMintKey: PublicKey;
  arbiterAta: PublicKey;
}

export const execute = async (payload: IExecute) => {
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
    if (match.state !== MatchStates.Started) {
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
    const tx = new web3.Transaction();

    tx.add(
      await program.methods
        .collectLoot()
        .accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
          game: accountKey,
          agreement: agreementId,
          arbiter: wallet.publicKey,
        })
        .remainingAccounts(
          owners
            .map((o) => ({
              pubkey: o.playerAta,
              isWritable: true,
              isSigner: false,
            }))
            .concat(
              owners.map((o) => ({
                pubkey: o.arbiterAta,
                isWritable: true,
                isSigner: false,
              }))
            )
        )
        .instruction()
    );
    await provider.sendAndConfirm(tx, []);
    const mintKeys = owners.map((o) => o.playerMintKey.toBase58());
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
    owners.forEach(async (o) => {
      const nft = mintMap[o.playerMintKey.toBase58()];
      const docRef = nftsCollection.doc(nft.id);
      batch.update(docRef, {
        owner: accountData.arbiter.toBase58(),
        account_id: o.arbiterAta.toBase58(),
      });
    });
    await batch.commit();
    await matchesCollection.doc(payload.match_id).update({
      state: MatchStates.Finished,
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
};
