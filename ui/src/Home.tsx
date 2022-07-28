import { Provider } from "@project-serum/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import React, { useContext, useState } from "react";
import { FC } from "react";
import { app, context, INFT, IStore } from "./constants";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { useCollectionOnce } from "react-firebase-hooks/firestore";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";

export interface IHomeProps {}

export const Home: FC<IHomeProps> = ({}) => {
  const [value, loading, error] = useCollectionOnce(
    collection(getFirestore(app), "nfts")
  );
  const data = useContext(context);
  if (!data.user.id) {
    return (
      <Typography sx={{ textAlign: "center" }} variant="h5">
        Please login to continue
      </Typography>
    );
  }
  return (
    <div className="nft-list">
      <div>
        <Typography sx={{ textAlign: "center" }} variant="h3">
          NFTs
        </Typography>
        <p>{error && <strong>Error: {JSON.stringify(error)}</strong>}</p>
      </div>
      <div className="nft-container">
        {value &&
          value.docs
            .map((doc) => doc.data() as INFT)
            .map((nft) => (
              <Card
                sx={{ width: 345, margin: 5 }}
                className="nft-item"
                key={nft.mint_key}
              >
                <CardMedia
                  component="img"
                  height="240"
                  image={nft.meta.image}
                  alt={nft.meta.name}
                />
                <CardContent>
                  <Typography gutterBottom variant="h5" component="div">
                    {nft.meta.name}
                  </Typography>
                  <Typography
                    gutterBottom
                    variant="h6"
                    component="div"
                    color="gold"
                    fontSize={11}
                    fontFamily={"monospace"}
                  >
                    {nft.mint_key}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {nft.meta.description}
                  </Typography>
                </CardContent>
                <CardActions>
                  {data.user.id == nft.owner && (
                    <Link to={"/" + nft.mint_key} className="clear-link">
                      <Button size="small">Transfer</Button>
                    </Link>
                  )}
                  <Link to={"/" + nft.mint_key} className="clear-link">
                    <Button size="small">Details</Button>
                  </Link>
                </CardActions>
              </Card>
            ))}
      </div>
    </div>
  );
};
