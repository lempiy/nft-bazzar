import React, { ReactNode, useEffect, useState } from "react";
import { FC } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { Home } from "./Home";

import { app, context, IStore, IUser } from "./constants";
import { Mint } from "./Mint";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import {
  addDoc,
  getDocs,
  getFirestore,
  collection,
  query,
  where,
} from "firebase/firestore";
import { NFT } from "./Nft";
import { Matches } from "./Matches";
import { Match } from "./Match";

const DataProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<IStore>({
    user: { id: "" },
    nfts: [],
    loading: false,
  });
  const wallet = useAnchorWallet();

  function setUserData(user: IUser) {
    setData({ ...data, user, loading: false });
  }

  async function saveUserDB(user: IUser): Promise<IUser> {
    const docRef = await addDoc(collection(getFirestore(app), "users"), user);
    return user;
  }

  async function getUserFromDB(id: string): Promise<IUser | null> {
    const c = collection(getFirestore(app), "users");
    const q = query(c, where("id", "==", id));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.docs.length) {
      return querySnapshot.docs[0].data() as IUser;
    }
    return null;
  }

  async function ensureUserData() {
    if (!wallet) {
      // clear user id from data if it's set on wallet disconnect
      if (data.user.id) {
        setUserData({ id: "" });
      }
      return;
    }
    if (data.user.id) return;
    if (data.loading) return;
    setData(() => ({ ...data, loading: true }));
    const user = await getUserFromDB(wallet!.publicKey.toString());
    if (!user) {
      const newUser = await saveUserDB({ id: wallet!.publicKey.toString() });
      return setUserData(newUser);
    }
    return setUserData(user);
  }

  useEffect(() => {
    ensureUserData();
  });

  const { Provider } = context;
  return <Provider value={data}>{children}</Provider>;
};

export const HFTBazzarRoutes: FC = () => {
  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mint" element={<Mint />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/:id" element={<NFT />} />
        <Route path="/matches/:id" element={<Match />} />
      </Routes>
    </DataProvider>
  );
};
