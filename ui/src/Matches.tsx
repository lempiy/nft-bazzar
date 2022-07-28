import { Provider } from "@project-serum/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import React, { useContext, useState } from "react";
import { FC } from "react";
import { app, context, IMatch, MatchStates } from "./constants";
import {
  getFirestore,
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { useCollection } from "react-firebase-hooks/firestore";
import {
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  useTheme,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { LooksOne, LooksTwo, CropSquare } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import Casino from "@mui/icons-material/Casino";

export interface IMatchesProps {}
export interface IMatchesState {
  loading: boolean;
  unsub?: () => void;
}

export const Matches: FC<IMatchesProps> = ({}) => {
  const [values, setValues] = useState<IMatchesState>({
    loading: false,
  });
  const navigator = useNavigate();
  const theme = useTheme();
  const wallet = useAnchorWallet();
  const c = collection(getFirestore(app), "matches");
  const q = query(c, where("state", "==", MatchStates.AccountReady));
  const [value, loading, error] = useCollection(q, {
    snapshotListenOptions: { includeMetadataChanges: true },
  });

  const data = useContext(context);
  if (!data.user.id) {
    return (
      <Typography sx={{ textAlign: "center" }} variant="h5">
        Please login to continue
      </Typography>
    );
  }
  const awaitState = async (id: string, state: MatchStates): Promise<void> => {
    console.log("await state", id, state);
    return new Promise((resolve) => {
      setValues({
        ...values,
        loading: true,
        unsub: onSnapshot(
          doc(getFirestore(app), "matches", id),
          { includeMetadataChanges: true },
          (doc) => {
            const match = doc.data() as IMatch;
            if (match.state !== state) return;
            values.unsub && values.unsub();
            resolve();
          }
        ),
      });
    });
  };

  const createNewMatch = async () => {
    setValues({ ...values, loading: true });
    const id = await saveMatchDB({
      date: new Date(),
      creator_key: wallet!.publicKey.toBase58(),
      state: MatchStates.New,
    });
    await awaitState(id, MatchStates.AccountReady);
    navigator(id);
  };

  async function saveMatchDB(match: IMatch): Promise<string> {
    const docRef = await addDoc(
      collection(getFirestore(app), "matches"),
      match
    );
    console.log("Match Document written with ID: ", docRef.id);
    return docRef.id;
  }

  return (
    <div className="matches-list">
      <div>
        <Typography sx={{ textAlign: "center" }} variant="h3">
          Join Matches
        </Typography>
        <p>{error && <strong>Error: {JSON.stringify(error)}</strong>}</p>
      </div>
      <div className="lohotrone">
        <LoadingButton
          variant="contained"
          endIcon={<Casino />}
          loading={values.loading}
          loadingPosition="center"
          className="input-nft justify-center"
          onClick={createNewMatch}
        >
          New "Лохотрон"
        </LoadingButton>
      </div>
      <List
        sx={{
          width: "100%",
          maxWidth: "680px",
          bgcolor: "background.paper",
          margin: "0 auto",
        }}
      >
        {value &&
          value.docs
            .map((doc) => ({ id: doc.id, match: doc.data() as IMatch }))
            .map((v) => (
              <Link to={v.id + "?join"} className="clear-link" key={v.id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      {v.match.player_one && v.match.player_two ? (
                        <LooksTwo />
                      ) : v.match.player_one || v.match.player_two ? (
                        <LooksOne />
                      ) : (
                        <CropSquare />
                      )}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={v.id}
                    primaryTypographyProps={{
                      color: theme.palette.text.primary,
                    }}
                    secondary={`${v.match.date?.toString()}`}
                    secondaryTypographyProps={{
                      color: theme.palette.text.primary,
                    }}
                  />
                </ListItem>
              </Link>
            ))}
      </List>
    </div>
  );
};
