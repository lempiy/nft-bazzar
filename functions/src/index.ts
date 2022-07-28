import {
  AnchorProvider,
  setProvider,
  Program,
} from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Connection, Keypair } from "@solana/web3.js";
import * as functions from "firebase-functions";
import { IDL, NftBazzar } from "./target/types/nft_bazzar";
import idl from "./target/idl/nft_bazzar.json";
import { createMatchAccount } from "./match/create";
import { IMatch, MatchStates } from "./match/states";
import express from "express";
import cors from "cors";
import { assign } from "./match/assign";
import { SOLANA_URL } from "./contants";
import { execute } from "./match/execute";
import { resolveGame } from "./match/resolve";

const assignApp = express();
assignApp.use(cors({ origin: true }));

const executeApp = express();
executeApp.use(cors({ origin: true }));

assignApp.post("/", async (req, res) => {
  res.send(await assign(req.body));
});
executeApp.post("/", async (req, res) => {
  res.send(await execute(req.body));
});

export const assignPlayers = functions.https.onRequest(assignApp);
export const executeAgreement = functions.https.onRequest(executeApp);

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const matchesCreate = functions.firestore
  .document("matches/{docId}")
  .onCreate(async (change, context) => {
    if (process.env.SOLANA_WALLET === undefined) {
      throw `SOLANA_WALLET is undefined`;
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
    const accountKey = await createMatchAccount(program, wallet);
    return change.ref.update({
      state: MatchStates.AccountReady,
      account_key: accountKey.toBase58(),
    });
  });

export const resolveMatch = functions.firestore
  .document("matches/{docId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as IMatch;
    const after = change.after.data() as IMatch;
    if (before.state == after.state || after.state != MatchStates.Finished)
      return;
    const id = change.after.id;
    const winnerKey =
      Math.random() > 0.5
        ? after.player_one?.player_authority
        : after.player_two?.player_authority;
    await resolveGame({ match_id: id, winner_key: winnerKey! });
  });
