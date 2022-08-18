import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import {
  WalletDialogProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-material-ui";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  GlowWalletAdapter,
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, Keypair } from "@solana/web3.js";
import { useSnackbar } from "notistack";
import React, { FC, ReactNode, useCallback, useMemo, useState } from "react";
import { Theme } from "./Theme";
import { HFTBazzarRoutes } from "./Routes";
import { Link, HashRouter as Router } from "react-router-dom";
import { Button, ButtonGroup, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { generateLink } from "./deeplink/link";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { getFirestore } from "firebase/firestore";
import { app, dialogContext, IDialogData } from "./constants";
import {
  PhantomDeepLinkWallet,
  PhantomDLWallet,
} from "./deeplink/PhantomWallet";
import { PhantomDeepLinkWalletAdapter } from "./deeplink/PhantomWalletAdapter";

export const App: FC = () => {
  return (
    <Theme>
      <Context>
        <Content />
      </Context>
    </Theme>
  );
};

const fs = getFirestore(app);

interface PhantomWindow extends Window {
  phantom?: {
    solana?: PhantomDeepLinkWallet;
  };
  solana?: PhantomDeepLinkWallet;
}

const Context: FC<{ children: ReactNode }> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Devnet;
  const [data, setData] = useState<IDialogData>({
    open: false,
  });
  const pw: PhantomDLWallet = useMemo(() => {
    return new PhantomDLWallet({
      network: network,
      storage: fs,
      host: window.location.href,
      openSignDialog: (payload) => {
        setData({...data, open: true, data: payload})
      },
      closeSignDialog: () => {
        setData({...data, open: false, data: undefined})
      }
    });
  }, [fs, network]);
  (window as PhantomWindow).phantom = {
    solana: pw,
  };
  (window as PhantomWindow).solana = pw;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking and lazy loading --
  // Only the wallets you configure here will be compiled into your application, and only the dependencies
  // of wallets that your users connect to will be loaded.
  const wallets = useMemo(
    () => [
      new PhantomDeepLinkWalletAdapter({
        wallet: pw,
      }),
      new PhantomWalletAdapter(),
      new GlowWalletAdapter(),
      new SlopeWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter(),
    ],
    [network]
  );

  const { enqueueSnackbar } = useSnackbar();
  const onError = useCallback(
    (error: WalletError) => {
      enqueueSnackbar(
        error.message ? `${error.name}: ${error.message}` : error.name,
        { variant: "error" }
      );
      console.error(error);
    },
    [enqueueSnackbar]
  );

  const onDialogClosed = () => {
    setData({...data, open: false, data: undefined})
    data.data && data.data.onClosed()
  }

  const { Provider } = dialogContext;
  return (
    <Provider value={{ data, setData }}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} onError={onError}>
          <WalletDialogProvider>
            <Router
              basename={
                window.location.pathname[window.location.pathname.length - 1] ==
                "/"
                  ? window.location.pathname.slice(
                      0,
                      window.location.pathname.length - 1
                    )
                  : window.location.pathname
              }
            >
              <div className="navbar">
                <ButtonGroup variant="text" aria-label="text button group">
                  <Link to="/matches" className="clear-link">
                    <Button color="secondary">MATCHES</Button>
                  </Link>
                  <Link to="/" className="clear-link">
                    <Button color="secondary">NFTs</Button>
                  </Link>
                  <Link to="/mint" className="clear-link">
                    <Button color="secondary">NEW MINT</Button>
                  </Link>
                </ButtonGroup>
                {children}
              </div>
              <div className="router-content">
                <HFTBazzarRoutes />
                <Dialog
                  open={data.open}
                  onClose={onDialogClosed}
                  aria-labelledby="alert-dialog-title"
                  aria-describedby="alert-dialog-description"
                >
                  <DialogTitle id="alert-dialog-title">
                    {data.data?.title}
                  </DialogTitle>
                  <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                      {data.data?.description}
                    </DialogContentText>
                  </DialogContent>
                  <DialogActions>
                    <a href={data.data?.link} target="_blank"  className="clear-link">
                      <Button variant="outlined" color="secondary">{data.data?.buttonText}</Button>
                    </a>
                  </DialogActions>
                </Dialog>
              </div>
            </Router>
          </WalletDialogProvider>
        </WalletProvider>
      </ConnectionProvider>
    </Provider>
  );
};

const Content: FC = () => {
  return <WalletMultiButton />;
};
