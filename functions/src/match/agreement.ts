import { AnchorProvider, Program, setProvider } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { fs, SOLANA_URL } from "../contants";
import { IDL, NftBazzar } from "../target/types/nft_bazzar";
import idl from "../target/idl/nft_bazzar.json";
import { IMatch, MatchStates } from "./states";

export interface ICreateAgreement {
  match_id: string;
}

export const createAgreement = async (
  payload: ICreateAgreement
): Promise<string> => {
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
    if (match.state !== MatchStates.AccountReady || !match.game_id) {
      throw `wrong match state`;
    }
    const gameAccountKey = new PublicKey(match.game_id);
    const options = AnchorProvider.defaultOptions();
    const connection = new Connection(SOLANA_URL, options.commitment);
    const payer = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.SOLANA_WALLET))
    );

    const wallet = new NodeWallet(payer);
    const agreement = Keypair.generate();
    const provider = new AnchorProvider(connection, wallet, options);
    setProvider(provider);
    const program = new Program(
      IDL,
      idl.metadata.address,
      provider!
    ) as Program<NftBazzar>;

    const accountKey = new PublicKey(match.account_key!);

    const accountData = await program.account.game.fetch(
      new PublicKey(accountKey.toBase58())
    );

    const txSize = 1000; // Big enough, cuz I'm lazy.
    const createInstr = await program.account.agreement.createInstruction(
      agreement,
      txSize
    );

    await program.methods
      .createAgreement()
      .accounts({
        game: gameAccountKey,
        agreement: agreement.publicKey,
        arbiter: accountData.arbiter,
      })
      .preInstructions([createInstr])
      .signers([agreement])
      .rpc();

    await matchesCollection.doc(payload.match_id).update({
      agreement_id: agreement.publicKey.toBase58(),
      state: MatchStates.Started,
    });
    return agreement.publicKey.toBase58();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
