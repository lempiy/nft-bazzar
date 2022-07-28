import {
  Grid,
  Box,
  Paper,
  Skeleton,
  Typography,
  Chip,
  Divider,
  TableContainer,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Link as UILink,
} from "@mui/material";
import React, { useContext, useEffect, useState } from "react";
import { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { styled } from "@mui/material/styles";
import { app, context, INFT } from "./constants";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Transfer } from "./Transfer";
import { Match } from "./Match";

interface INFTProps {}

interface INFTState {
  loading: boolean;
  nft?: INFT;
  worth?: number;
  id?: string;
}

const Section = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(2),
  color: theme.palette.text.secondary,
  height: "100%",
}));

export const NFT: FC<INFTProps> = () => {
  const [state, setState] = useState<INFTState>({ loading: true });
  const params = useParams();
  const navigate = useNavigate();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  async function updateNFTFromDB(id: string) {
    const c = collection(getFirestore(app), "nfts");
    const q = query(c, where("mint_key", "==", id));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.docs.length) {
      const nft = querySnapshot.docs[0].data() as INFT;
      const docID = querySnapshot.docs[0].id;
      const info = await connection.getParsedAccountInfo(
        new PublicKey(nft.mint_key)
      );
      console.log(nft, info);
      setState(() => ({
        ...state,
        loading: false,
        worth: info.value!.lamports / LAMPORTS_PER_SOL,
        nft,
        id: docID,
      }));
    } else {
      navigate("/");
    }
  }
  useEffect(() => {
    if (!wallet && !state.loading) {
      setState(() => ({
        ...state,
        loading: true,
      }));
      return;
    }
    if (!params.id) {
      return navigate("/");
    }
    if (!wallet) {
      return;
    }
    if (state.nft?.mint_key == params.id) {
      if (state.loading) {
        setState(() => ({
          ...state,
          loading: false,
        }));
      }
      return;
    }
    updateNFTFromDB(params.id as string);
  });
  return wallet ? (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Section className="flex-center image-container">
            {!state.loading ? (
              <img
                src={state.nft!.meta.image}
                alt={state.nft?.meta.name}
                width={280}
                height={"auto"}
              />
            ) : (
              <Skeleton variant="rectangular" width={"100%"} height={300} />
            )}
          </Section>
        </Grid>
        <Grid item xs={8}>
          <Section>
            <Typography variant="h3">
              {!state.loading ? state.nft?.meta.name : <Skeleton />}
            </Typography>
            <Typography
              variant="h5"
              color="gold"
              fontSize={13}
              fontFamily={"monospace"}
            >
              {!state.loading ? state.nft?.mint_key : <Skeleton />}
            </Typography>
            <Typography variant="h6" fontFamily={"monospace"}>
              {!state.loading ? `${state.worth} SOL` : <Skeleton />}
            </Typography>
            <div className="chip-list">
              {state.nft?.meta.attributes.map((a) => (
                <Chip
                  className="chip"
                  key={`${a.trait_type}:${a.display_type || a.value}`}
                  label={`${a.trait_type}: ${a.value || a.display_type}`}
                  variant="outlined"
                />
              ))}
            </div>
            <Divider />
            <div className="description-block">
              <Typography variant="body1">
                {!state.loading ? state.nft?.meta.description : <Skeleton />}
              </Typography>
            </div>
          </Section>
        </Grid>
        <Grid item xs={12}>
          <Section>
            {!state.loading ? (
              <TableContainer component={"div"}>
                <Table sx={{ minWidth: "100%" }} aria-label="simple table">
                  <TableBody>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        <b>Mint Key</b>
                      </TableCell>
                      <TableCell align="right">
                        <UILink
                          underline="hover"
                          target="_blank"
                          href={`https://explorer.solana.com/address/${state.nft?.mint_key}?cluster=testnet`}
                        >
                          {state.nft?.mint_key}
                        </UILink>
                      </TableCell>
                    </TableRow>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        <b>Owner</b>
                      </TableCell>
                      <TableCell align="right">
                        <UILink
                          underline="hover"
                          target="_blank"
                          href={`https://explorer.solana.com/address/${state.nft?.owner}?cluster=testnet`}
                        >
                          {state.nft?.owner}
                        </UILink>
                      </TableCell>
                    </TableRow>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        <b>Update Authority</b>
                      </TableCell>
                      <TableCell align="right">
                        <UILink
                          underline="hover"
                          target="_blank"
                          href={`https://explorer.solana.com/address/${state.nft?.authority}?cluster=testnet`}
                        >
                          {state.nft?.authority}
                        </UILink>
                      </TableCell>
                    </TableRow>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        <b>Associated Token Account</b>
                      </TableCell>
                      <TableCell align="right">
                        <UILink
                          underline="hover"
                          target="_blank"
                          href={`https://explorer.solana.com/address/${state.nft?.account_id}?cluster=testnet`}
                        >
                          {state.nft?.account_id}
                        </UILink>
                      </TableCell>
                    </TableRow>
                    <TableRow
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        <b>Mint TX</b>
                      </TableCell>
                      <TableCell align="right">
                        <UILink
                          underline="hover"
                          target="_blank"
                          href={`https://explorer.solana.com/tx/${state.nft?.mint_tx_id}?cluster=testnet`}
                        >
                          {state.nft?.mint_tx_id}
                        </UILink>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <div>
                <Typography variant="h4">
                  <Skeleton />
                </Typography>
                <Typography variant="h4">
                  <Skeleton />
                </Typography>
                <Typography variant="h4">
                  <Skeleton />
                </Typography>
                <Typography variant="h4">
                  <Skeleton />
                </Typography>
              </div>
            )}
          </Section>
        </Grid>
        {!state.loading &&
          state.nft &&
          state.nft.owner == wallet.publicKey.toString() && (
            <Grid item xs={12}>
              <Section>
                <Transfer
                  nft={state.nft}
                  id={state.id!}
                  onTransferred={(owner) => updateNFTFromDB(params.id!)}
                />
              </Section>
            </Grid>
          )}
      </Grid>
    </Box>
  ) : (
    <Typography sx={{ textAlign: "center" }} variant="h5">
      Please login to continue
    </Typography>
  );
};
