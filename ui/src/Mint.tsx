import { PhotoCamera } from "@mui/icons-material";
import { Button, IconButton, TextField, Typography } from "@mui/material";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { SystemProgram, TransactionError, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useSnackbar } from "notistack";
import React, { FC, FormEvent, ChangeEvent, useState, useCallback } from "react"
import { app, client, getNFTMetaData, INFT, NFTMeta, toFile, TOKEN_METADATA_PROGRAM_ID } from "./constants";
import { NftBazzar, IDL } from '../../target/types/nft_bazzar';
import idl from '../../target/idl/nft_bazzar.json';
import { AnchorProvider, Program, web3 } from "@project-serum/anchor";
import { createAssociatedTokenAccountInstruction, createInitializeMintInstruction, getAssociatedTokenAddress, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { addDoc, collection, getFirestore } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { LoadingButton } from "@mui/lab";
import { ElectricBoltRounded, AccountBalanceWalletOutlined } from '@mui/icons-material';

interface State {
    title: string
    description: string
    file: File | null
    loading: boolean
}

const DROP_AMOUNT = 1;

export const Mint: FC = () => {
    const {connection} = useConnection();
    const wallet = useAnchorWallet();
    const navigate = useNavigate();

    const provider = wallet ? new AnchorProvider(connection, wallet, {
        "preflightCommitment": "processed"
    }) : null;
    const [values, setValues] = useState<State>({
        title: '',
        description: '',
        file: null,
        loading: false,
    });
    

    const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValues((values) => ({
            ...values,
            title: e.target.value,
        }));
    }
    const handleDescriptionChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValues((values) => ({
            ...values,
            description: e.target.value,
        }));
    }
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setValues((values) => ({
            ...values,
            file: e.target.files![0],
        }));
    }
    const uploadIpfs = async (file: File): Promise<string> => {
        const added = await client.add(file)
        console.log(`https://ipfs.infura.io/ipfs/${added.path}`)
        return `https://ipfs.infura.io/ipfs/${added.path}`
    }
    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        console.log(values)
        if (!values.file) return;
        setValues((values) => ({
            ...values,
            loading: true,
        }));
        try {
            const url = await uploadIpfs(values.file);
            const meta = getNFTMetaData(values.title, values.description, url, wallet!.publicKey.toString());
            const f = toFile('meta.json', meta);
            const metaUrl = await uploadIpfs(f);
            const nft = await mint(values.title, meta.symbol, metaUrl, meta);
            await saveNFTDB(nft)
            navigate('/'+nft.mint_key)
        } catch (e) {
            onError(e as TransactionError)
        }

    }

    async function saveNFTDB(nft: INFT): Promise<INFT> {
        const docRef = await addDoc(collection(getFirestore(app), "nfts"), nft);
        console.log("NFT Document written with ID: ", docRef.id);
        return nft
    }

    const { enqueueSnackbar } = useSnackbar();
    const onDrop = useCallback(
        (text: string) => {
            enqueueSnackbar(text, { variant: 'success' });
        },
        [enqueueSnackbar]
    );
    const onError = useCallback(
        (error: TransactionError) => {
            enqueueSnackbar(error.toString(), { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );


    /// Solana Transactions START
    async function airdropOneSolana() {
        setValues((values) => ({
            ...values,
            loading: true,
        }));
        try {
            await connection.requestAirdrop(wallet!.publicKey, DROP_AMOUNT * LAMPORTS_PER_SOL);
            const balance = await getBalance();
            onDrop(`Dropped ${DROP_AMOUNT} SOL. Current balance: ${balance} SOL`);
        } catch (e: unknown) {
            onError(e as TransactionError)
        } finally {
            setValues((values) => ({
                ...values,
                loading: false,
            }));
        }
    }

    async function getBalance(): Promise<number> {
        let balance = await connection.getBalance(wallet!.publicKey);
        return balance / LAMPORTS_PER_SOL;
    }

    async function mint(title: string, symbol: string, metaURL: string, meta: NFTMeta): Promise<INFT> {
        const mintKey: web3.Keypair = web3.Keypair.generate();
        const program = new Program(IDL, idl.metadata.address, provider!) as Program<NftBazzar>;
        const lamports: number =
        await program.provider.connection.getMinimumBalanceForRentExemption(
            MINT_SIZE
        );
    const getMetadata = async (
        mint: web3.PublicKey
    ): Promise<web3.PublicKey> => {
      return (
          await web3.PublicKey.findProgramAddress(
              [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
              ],
              TOKEN_METADATA_PROGRAM_ID
          )
      )[0];
    };

    const getMasterEdition = async (
        mint: web3.PublicKey
    ): Promise<web3.PublicKey> => {
      return (
          await web3.PublicKey.findProgramAddress(
              [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
                Buffer.from("edition"),
              ],
              TOKEN_METADATA_PROGRAM_ID
          )
      )[0];
    };


    const NftTokenAccount = await getAssociatedTokenAddress(
        mintKey.publicKey,
        wallet!.publicKey
    );
    console.log("NFT Account: ", NftTokenAccount.toBase58());

    const mint_tx = new web3.Transaction().add(
        web3.SystemProgram.createAccount({
          fromPubkey: wallet!.publicKey,
          newAccountPubkey: mintKey.publicKey,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
          lamports,
        }),
        createInitializeMintInstruction(
            mintKey.publicKey,
            0,
            wallet!.publicKey,
            wallet!.publicKey
        ),
        createAssociatedTokenAccountInstruction(
            wallet!.publicKey,
            NftTokenAccount,
            wallet!.publicKey,
            mintKey.publicKey
        )
    );

    const res = await program.provider.sendAndConfirm!(mint_tx, [mintKey]);
    console.log(
        await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
    );

    console.log("Account: ", res);
    console.log("Mint key: ", mintKey.publicKey.toString());
    console.log("User: ", wallet!.publicKey.toString());

    const metadataAddress = await getMetadata(mintKey.publicKey);
    const masterEdition = await getMasterEdition(mintKey.publicKey);

    console.log("Metadata address: ", metadataAddress.toBase58());
    console.log("MasterEdition: ", masterEdition.toBase58());

    const tx = await program.methods.mintNft(
        mintKey.publicKey,
        metaURL,
        title,
        "NFTB",
    )
        .accounts({
              mintAuthority: wallet!.publicKey,
              mint: mintKey.publicKey,
              tokenAccount: NftTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
              metadata: metadataAddress,
              tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
              payer: wallet!.publicKey,
              systemProgram: SystemProgram.programId,
              rent: web3.SYSVAR_RENT_PUBKEY,
              masterEdition: masterEdition,
            },
        )
        .rpc();
    console.log("Your transaction signature", tx);
    return {
        account_id: NftTokenAccount.toBase58(),
        owner: wallet!.publicKey.toBase58(),
        authority: wallet!.publicKey.toBase58(),
        meta: meta,
        mint_key: mintKey.publicKey.toBase58(),
        mint_tx_id: tx,
        meta_url: metaURL,
    }   
    }
    /// Solana Transactions END
    
    return <div className="mint">
                {
                !wallet ? 
                <Typography sx={{textAlign: 'center'}} variant="h5">Please login to continue</Typography> : 
                    <form
                        noValidate
                        autoComplete="off"
                        onSubmit={onSubmit}
                        >
                        <h1 className="heading">Upload And Mint NFT</h1>
                        <TextField 
                            id="title" 
                            label="NFT Title" 
                            onChange={handleTitleChange} 
                            variant="outlined" 
                            className="input-nft" 
                            required 
                            />
                        <div>
                            <label htmlFor="contained-button-file">
                            <input type="file" accept="image/*" id="contained-button-file" hidden required onChange={handleFileChange}  />
                            <Button variant="contained" component="span">
                                Pick image
                            </Button>
                            <IconButton color="primary" aria-label="upload picture" component="span">
                                <PhotoCamera />
                            </IconButton>
                            </label>
                        </div>
                        <TextField
                            id="description"
                            label="Description"
                            multiline
                            rows={4}
                            variant="outlined"
                            className="input-nft"
                            onChange={handleDescriptionChange}
                            required
                            />
                        <LoadingButton variant="contained"  endIcon={<ElectricBoltRounded/>} loading={values.loading}
                            loadingPosition="center" className="input-nft justify-center" type="submit">CRAFT</LoadingButton>
                        <LoadingButton variant="outlined"  endIcon={<AccountBalanceWalletOutlined/>} loading={values.loading}
                            loadingPosition="center" className="input-nft justify-center" type="button" onClick={airdropOneSolana}>DROP {DROP_AMOUNT} SOL</LoadingButton>
                    </form> 
                }
            </div>
}
