import { CircularProgress, FormControl, Grid, IconButton, InputLabel, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";
import React, { ChangeEvent, useState } from "react";
import { FC } from "react";
import { app, INFT, IUser } from "./constants";
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import { collection, getFirestore, query, updateDoc, doc, where } from "firebase/firestore";
import { useCollectionOnce } from "react-firebase-hooks/firestore";
import { PublicKey } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, web3 } from "@project-serum/anchor";
import { NftBazzar, IDL } from '../../target/types/nft_bazzar';
import idl from '../../target/idl/nft_bazzar.json';

interface ITransferProps {
    nft: INFT,
    id: string,
    onTransferred?: (newOwner: string) => void,
}

interface ITransferState {
    pickedUserID: string,
    isTransferring: boolean,
}

export const Transfer: FC<ITransferProps> = ({nft, id, onTransferred}) => {
    
    const [state, setState] = useState<ITransferState>({pickedUserID: '', isTransferring: false});

    const [value, loading, error] = useCollectionOnce(
        collection(getFirestore(app), 'users')
    )
    const wallet = useAnchorWallet();
    const {connection} = useConnection();
    const provider = new AnchorProvider(connection, wallet!, {
        "preflightCommitment": "processed"
    });
    const program = new Program(IDL, idl.metadata.address, provider!) as Program<NftBazzar>;

    const users = loading ? [] : value!.docs.map((doc) => doc.data() as IUser);

    const handleChange = (event: SelectChangeEvent<string | null>) => {
        setState(() => ({...state, pickedUserID: event.target.value || ''}))
    }

    const createNewATA = async (toWallet: PublicKey, mintKey: PublicKey): Promise<PublicKey> => {
        const toATA = await getAssociatedTokenAddress(
        mintKey,
        toWallet
        );
        // Fires a list of instructions
        const mint_tx = new web3.Transaction().add(
        // Create the ATA account that is associated with our To wallet
        createAssociatedTokenAccountInstruction(
            wallet!.publicKey!, toATA, toWallet, mintKey,
        )
        );
        
        // Sends and create the transaction
        await provider.sendAndConfirm(mint_tx, []);
        return toATA;
    }

    const transfer = async () => {
        setState(() => ({...state, isTransferring: true}))
        const toWallet: PublicKey = new PublicKey(state.pickedUserID);
        const mintKey: PublicKey = new PublicKey(nft.mint_key);
        const account = await connection.getTokenAccountsByOwner(toWallet, {
            mint: mintKey,
        });
      
        // The ATA for a token on the to wallet (but might not exist yet)
        const toATA = account.value.length ? account.value[0].pubkey : await createNewATA(toWallet, mintKey);

        // Executes our transfer smart contract 
        const fromATA = new PublicKey(nft.account_id);
        console.log({
            tokenProgram: TOKEN_PROGRAM_ID,
            from: fromATA.toString(),
            fromAuthority: wallet!.publicKey.toString(),
            to: toATA.toString(),
        })
        await program.methods.transferToken().accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
          from: fromATA,
          fromAuthority: wallet!.publicKey,
          to: toATA,
        }).rpc();
        // Get minted token amount on the ATA for our anchor wallet
        console.log('fromATA', await connection.getParsedAccountInfo(fromATA));
        console.log('toAta', await connection.getParsedAccountInfo(toATA));
        const c = collection(getFirestore(app), "nfts");
        const docRef = doc(c, id)
        updateDoc(docRef, {"owner": state.pickedUserID, account_id: toATA.toBase58()})
        setState(() => ({...state, isTransferring: false}))
        onTransferred && onTransferred(state.pickedUserID)
    };
    
    return <div> 
        <Typography variant="h4" className="text-center m-b-15">
            Transfer token
        </Typography>
        <Grid container spacing={2} className="justify-center stretch">
        <Grid item xs={5} >
            <FormControl fullWidth>
                <InputLabel id="wallet-label">From</InputLabel>
                <Select
                    labelId="wallet-label"
                    id="wallet-id"
                    value={nft.owner}
                    label="From"
                    disabled={true}
                >
                    <MenuItem value={nft.owner}>{nft.owner}</MenuItem>
                </Select>
            </FormControl>
        </Grid>
        <Grid item xs={2} className="text-center justify-center stretch">
            <div className="transfer-holder">
                <IconButton onClick={transfer} color="secondary" aria-label="transfer token" size="large" disabled={!state.pickedUserID || state.isTransferring}>
                    {state.isTransferring ? <CircularProgress color="secondary" /> : <ChangeCircleIcon fontSize="large"/>}
                </IconButton>
            </div>
        </Grid>
        <Grid item xs={5} className="text-right justify-center stretch">
            <FormControl fullWidth>
                <InputLabel id="wallet-label">To</InputLabel>
                <Select
                
                    labelId="wallet-label"
                    id="wallet-id"
                    value={state.pickedUserID}
                    label="To"
                    onChange={handleChange}
                    disabled={state.isTransferring}
                >
                    {users.filter((u) => u.id != nft.owner).map((u: IUser) => (<MenuItem key={u.id} value={u.id}>{u.id}</MenuItem>))}
                </Select>
            </FormControl>
        </Grid>
    </Grid></div>
}
