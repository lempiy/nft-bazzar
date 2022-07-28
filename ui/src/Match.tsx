import {
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  SelectChangeEvent,
  Typography,
  FormHelperText,
  Paper,
  LinearProgress,
} from "@mui/material";
import React, { ChangeEvent, useCallback, useEffect, useState } from "react";
import { FC } from "react";
import {
  app,
  IMatch,
  INFT,
  IUser,
  assignPlayersURL,
  IAssignPayload,
  MatchStates,
  executeAgreement,
} from "./constants";
import JoinFull from "@mui/icons-material/JoinFull";
import {
  collection,
  getFirestore,
  query,
  updateDoc,
  doc,
  where,
  addDoc,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { useDocument } from "react-firebase-hooks/firestore";
import {
  GetProgramAccountsFilter,
  PublicKey,
  SystemProgram,
  TransactionError,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, web3 } from "@project-serum/anchor";
import { NftBazzar, IDL } from "../../target/types/nft_bazzar";
import idl from "../../target/idl/nft_bazzar.json";

import { useSnackbar } from "notistack";
import { useParams, useSearchParams } from "react-router-dom";
import { LoadingButton } from "@mui/lab";
import { Casino, Category } from "@mui/icons-material";

interface IMatchState {
  isMatching: boolean;
  myNfts?: INFT[];
  opposedNFTs?: INFT[];
  fetching: boolean;
  player1BetNftMintKey: string;
  player2BetNftMintKey: string;
  betting: boolean;
  playing: boolean;
  locked: boolean;
  match?: IMatch;
}

interface PlayerBet {
  playerAuthority: PublicKey;
  playerAta: PublicKey;
  playerMintKey: PublicKey;
  arbiterAta: PublicKey;
  winnerAta: PublicKey | null;
}

interface Agreement {
  didExecute: boolean;
  game: PublicKey;
  signers: boolean[];
}

const playerOrStateChanged = (prevVal: IMatch, newVal: IMatch) => {
  return (
    prevVal.player_one?.player_mint_key != newVal.player_one?.player_mint_key ||
    prevVal.player_two?.player_mint_key != newVal.player_two?.player_mint_key ||
    prevVal.state != newVal.state ||
    (prevVal.state != newVal.state && newVal.state == MatchStates.LootResolved)
  );
};

export const Match: FC = () => {
  const [state, setState] = useState<IMatchState>({
    isMatching: false,
    locked: false,
    betting: false,
    fetching: false,
    player1BetNftMintKey: "",
    player2BetNftMintKey: "",
    playing: false,
  });
  const params = useParams();
  const [searchParams] = useSearchParams();
  const wallet = useAnchorWallet();
  const [value, loading, error] = useDocument(
    doc(getFirestore(app), "matches", params.id as string)
  );

  const remoteMatchDataChanged =
    value?.exists() && state.match
      ? playerOrStateChanged(state.match, value.data() as IMatch)
      : false;
  const isJoin = searchParams.has("join");
  const { connection } = useConnection();
  const { enqueueSnackbar } = useSnackbar();
  const onDrop = useCallback(
    (text: string) => {
      enqueueSnackbar(text, { variant: "success" });
    },
    [enqueueSnackbar]
  );
  const onError = useCallback(
    (error: TransactionError) => {
      enqueueSnackbar(error.toString(), { variant: "error" });
      console.error(error);
    },
    [enqueueSnackbar]
  );
  const c = collection(getFirestore(app), "nfts");

  useEffect(() => {
    if (!wallet) return;
    if (loading) return;
    if (state.myNfts) return;
    if (state.fetching) return;
    setState({ ...state, fetching: true });
    const q = query(c, where("owner", "==", wallet!.publicKey.toBase58()));
    getDocs(q)
      .then((snaphot) => {
        const nfts = snaphot.docs.map((ref) => ref.data() as INFT);
        const match = value!.data() as IMatch;
        return { match, nfts };
      })
      .then(async ({ match, nfts }) => {
        const { opposedNFTs } = await fetchMatchDataAccount(match);
        setState({
          ...state,
          myNfts: nfts,
          opposedNFTs,
          fetching: false,
          match,
          locked: isJoin ? !!match.player_two : !!match.player_one,
          player1BetNftMintKey: match.player_one?.player_mint_key || "",
          player2BetNftMintKey: match.player_two?.player_mint_key || "",
        });
      });
  });

  if (!wallet)
    return (
      <Typography variant="h1" className="text-center m-b-25">
        Please login
      </Typography>
    );

  const id = params.id as string;

  const provider = new AnchorProvider(connection, wallet!, {
    preflightCommitment: "processed",
  });

  const program = new Program(IDL, idl.metadata.address, provider!) as Program<
    NftBazzar
  >;

  const handleChange = (event: SelectChangeEvent<string>) => {
    return isJoin
      ? setState({ ...state, player2BetNftMintKey: event.target.value || "" })
      : setState({ ...state, player1BetNftMintKey: event.target.value || "" });
  };

  const fetchMatchDataAccount = async (match: IMatch) => {
    const opposedNFTs: INFT[] = [];
    if (match.state == MatchStates.LootResolved) {
      const q2 = query(
        c,
        where("mint_key", "in", [
          match.player_one?.player_mint_key,
          match.player_two?.player_mint_key,
        ])
      );
      const snap = await getDocs(q2);
      opposedNFTs.push(...snap.docs.map((ref) => ref.data() as INFT));
    } else if ((isJoin && match.player_one) || (!isJoin && match.player_two)) {
      const q2 = query(
        c,
        where(
          "mint_key",
          "==",
          isJoin
            ? match.player_one?.player_mint_key
            : match.player_two?.player_mint_key
        )
      );
      const snap = await getDocs(q2);
      opposedNFTs.push(...snap.docs.map((ref) => ref.data() as INFT));
    }
    return {
      opposedNFTs,
    };
  };

  const reapplyFetchMatchDataAccount = async (match: IMatch, nfts: INFT[]) => {
    const { opposedNFTs } = await fetchMatchDataAccount(match);
    setState({
      ...state,
      myNfts: nfts,
      opposedNFTs,
      betting: false,
      fetching: false,
      match,
      locked: isJoin ? !!match.player_two : !!match.player_one,
      player1BetNftMintKey:
        match.player_one?.player_mint_key || state.player1BetNftMintKey,
      player2BetNftMintKey:
        match.player_two?.player_mint_key || state.player2BetNftMintKey,
    });
  };

  if (remoteMatchDataChanged) {
    reapplyFetchMatchDataAccount(value?.data() as IMatch, state.myNfts!);
  }

  const getTokenAccounts = async () => {
    const filters: GetProgramAccountsFilter[] = [
      {
        dataSize: 165,
      },
      {
        memcmp: {
          offset: 32, //location of our query in the account (bytes)
          bytes: wallet!.publicKey.toBase58(), //our search criteria, a base58 encoded string
        },
      },
    ];
    connection.getParsedTokenAccountsByOwner;
    return await connection.getParsedProgramAccounts(
      TOKEN_PROGRAM_ID, //SPL Token Program, new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
      {
        filters,
        commitment: connection.commitment,
      }
    );
  };

  const isReadyToBet = isJoin
    ? !!state.player2BetNftMintKey
    : !!state.player1BetNftMintKey;
  const ready = async () => {
    await fetch(executeAgreement, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ match_id: id }),
    });
  };

  const play = async () => {
    setState(() => ({ ...state, playing: true }));
    const gameKey = new web3.PublicKey(state.match?.account_key!);
    const agreementKey = new web3.PublicKey(state.match?.agreement_id!);
    const acc = await program.account.game.fetch(gameKey);
    const me = (acc.bets as PlayerBet[]).find(
      (b) => b.playerAuthority.toBase58() == wallet.publicKey.toBase58()
    )!;
    // Executes our transfer smart contract
    await program.methods
      .approveAgreement()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
        game: gameKey,
        authority: me.playerAuthority,
        to: me.playerAta,
        agreement: agreementKey,
        arbiter: acc.arbiter,
      })
      .rpc();
    const subs = await program.account.agreement.subscribe(agreementKey);
    subs.on("change", (agreement: Agreement) => {
      if (agreement.signers.every((a) => a) && !isJoin) {
        subs.removeAllListeners();
        ready();
      }
    });
    console.log("approved delegation");
  };
  const assign = async () => {
    setState(() => ({ ...state, betting: true }));
    const betMintKey = isJoin
      ? state.player2BetNftMintKey
      : state.player1BetNftMintKey;
    const nft = state.myNfts?.find((nft) => nft.mint_key == betMintKey);
    const payload: IAssignPayload = {
      is_player_one: !isJoin,
      from_ata_key: nft?.account_id!,
      match_id: id,
      mint_key: nft?.mint_key!,
      owner_key: wallet.publicKey.toBase58(),
    };
    await fetch(assignPlayersURL, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });
    setState(() => ({ ...state, betting: false }));
  };

  const renderActionBlock = (): React.ReactNode => {
    switch (state.match?.state) {
      case MatchStates.LootResolved:
        return (
          <div className="lohotrone">
            <Typography variant="h4" className="text-center">
              {state.match?.winner_key === wallet.publicKey.toBase58()
                ? "You won"
                : "You lost"}
            </Typography>
          </div>
        );
      case MatchStates.Finished:
        return (
          <div className="lohotrone text-center">
            <Typography variant="subtitle1" className="text-center">
              Spinning "Лохотрон"...
            </Typography>
            <CircularProgress color="secondary" />
          </div>
        );
      case MatchStates.Started:
        return (
          <div className="lohotrone">
            <LoadingButton
              variant="contained"
              endIcon={<Category />}
              loading={state.playing}
              loadingPosition="center"
              className="input-nft justify-center"
              onClick={play}
            >
              Ready!
            </LoadingButton>
          </div>
        );
    }
    return (
      <div className="lohotrone">
        <LoadingButton
          variant="contained"
          endIcon={<Casino />}
          loading={state.betting}
          disabled={state.locked || !isReadyToBet}
          loadingPosition="center"
          className="input-nft justify-center"
          onClick={assign}
        >
          Bet
        </LoadingButton>
      </div>
    );
  };

  return loading || !state.myNfts ? (
    <Typography variant="h1" className="text-center m-b-25">
      Loading ...
    </Typography>
  ) : (
    <div>
      <Typography variant="h1" className="text-center m-b-25">
        Match
      </Typography>
      <Grid container spacing={2} className="justify-center stretch">
        <Grid item xs={6}>
          <Typography variant="h6" className="text-center">
            Player 1
          </Typography>
          {state.match?.state == MatchStates.LootResolved ? (
            <div>
              <Paper className="lot">
                <img
                  src={
                    state.opposedNFTs!.find(
                      (nft) =>
                        nft.mint_key == state.match?.player_one?.player_mint_key
                    )?.meta.image
                  }
                  alt="Bet 1"
                />
              </Paper>
            </div>
          ) : (
            <div>
              <div>
                <FormControl sx={{ width: "100%" }}>
                  <InputLabel id="choose-nft">Player I</InputLabel>
                  <Select
                    labelId="choose-nft"
                    id="choose-nft"
                    value={state.player1BetNftMintKey}
                    label="Bet NFT"
                    disabled={state.locked || isJoin}
                    onChange={handleChange}
                  >
                    {(!isJoin ? state.myNfts! : state.opposedNFTs!).map(
                      (nft) => (
                        <MenuItem key={nft.mint_key} value={nft.mint_key}>
                          {nft.meta.name}
                        </MenuItem>
                      )
                    )}
                  </Select>
                  <FormHelperText>
                    {!isJoin ? "Choose NFT to Bet" : "Opponents Bet"}
                  </FormHelperText>
                </FormControl>
              </div>
              {state.player1BetNftMintKey && (
                <Paper className="lot">
                  <img
                    src={
                      (!isJoin ? state.myNfts! : state.opposedNFTs!).find(
                        (nft) => nft.mint_key == state.player1BetNftMintKey
                      )?.meta.image
                    }
                    alt="Bet 2"
                  />
                </Paper>
              )}
            </div>
          )}
        </Grid>
        <Grid item xs={6}>
          <Typography variant="h6" className="text-center">
            Player 2
          </Typography>
          {state.match?.state == MatchStates.LootResolved ? (
            <div>
              <Paper className="lot">
                <img
                  src={
                    state.opposedNFTs!.find(
                      (nft) =>
                        nft.mint_key == state.match?.player_two?.player_mint_key
                    )?.meta.image
                  }
                  alt="Bet 2"
                />
              </Paper>
            </div>
          ) : (
            <div>
              <div>
                <FormControl sx={{ width: "100%" }}>
                  <InputLabel id="choose-nft">Player II</InputLabel>
                  <Select
                    labelId="choose-nft"
                    id="choose-nft"
                    value={state.player2BetNftMintKey}
                    label="Bet NFT"
                    disabled={state.locked || !isJoin}
                    onChange={handleChange}
                  >
                    {(isJoin ? state.myNfts! : state.opposedNFTs!).map(
                      (nft) => (
                        <MenuItem key={nft.mint_key} value={nft.mint_key}>
                          {nft.meta.name}
                        </MenuItem>
                      )
                    )}
                  </Select>
                  <FormHelperText>
                    {isJoin ? "Choose NFT to Bet" : "Opponents Bet"}
                  </FormHelperText>
                </FormControl>
              </div>
              {state.player2BetNftMintKey && (
                <Paper className="lot">
                  <img
                    src={
                      (isJoin ? state.myNfts! : state.opposedNFTs!).find(
                        (nft) => nft.mint_key == state.player2BetNftMintKey
                      )?.meta.image
                    }
                    alt="Bet 2"
                  />
                </Paper>
              )}
            </div>
          )}
        </Grid>
      </Grid>
      {renderActionBlock()}
    </div>
  );
};
