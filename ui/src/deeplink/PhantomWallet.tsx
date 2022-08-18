import type { EventEmitter, WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { EventEmitter as EE } from 'eventemitter3';
import { Connection, SendOptions, Transaction, TransactionSignature } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { generateLink, generatePayloadLink } from './link';
import { getSolanaEndpoint, PhantomEventCreate, PhantomRemoteEvent } from './types';
import { doc, Firestore, onSnapshot, Unsubscribe } from "firebase/firestore";
import bs58 from 'bs58';
import { IDialogPayload } from '../constants';


interface PhantomDeepLinkWalletEvents {
    connect(...args: unknown[]): unknown;
    disconnect(...args: unknown[]): unknown;
}

export interface PhantomDeepLinkWallet extends EventEmitter<PhantomDeepLinkWalletEvents> {
    isPhantom?: boolean;
    publicKey?: { toBytes(): Uint8Array };
    isConnected: boolean;
    signTransaction(transaction: Transaction): Promise<Transaction>;
    signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
    signAndSendTransaction(
        transaction: Transaction,
        options?: SendOptions
    ): Promise<{ signature: TransactionSignature }>;
    signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    _handleDisconnect(...args: unknown[]): unknown;
}

interface PhantomDLWalletConfig {
    network: WalletAdapterNetwork
    host: string
    storage: Firestore
    openSignDialog: (data: IDialogPayload) => void
    closeSignDialog: () => void
}

interface ConnectResult {
    public_key: string;
    session: string;
}

interface DisconnectResult {}

interface SignResult {
    transaction: string, // signed serialized transaction, base58 encoded
}
interface SignAllResult {
    transactions: string[]
}

interface SignMessageResult {
    signature: string, 
}

interface SignAndSendResult {
    signature: string,
}

interface LoginData  {
    public_key: string;
    session: string;
    phantom_encryption_public_key: string;
};

export class PhantomDLWallet extends EE<PhantomDeepLinkWalletEvents> {
    isPhantom = true;
    publicKey?: { toBytes(): Uint8Array };
    private storage: Firestore;
    private network: WalletAdapterNetwork;
    private host: string;
    private loginData?: LoginData;
    private connection: Connection;
    private open: (data: IDialogPayload) => void;
    private close: () => void;
    constructor (config: PhantomDLWalletConfig) {
        super();
        this.storage = config.storage;
        this.network = config.network;
        this.host = config.host;
        this.open = config.openSignDialog;
        this.close = config.closeSignDialog;
        const endpoint = getSolanaEndpoint(this.network);
        this.connection = new Connection(endpoint)
    }

    get isConnected(): boolean {
        return !!this.loginData;
    }

    async connect(): Promise<void> {
        const loginData = localStorage.getItem('_phantomLogin');
        if (!loginData) {
            return this._connect();
        }
        this.loginData = JSON.parse(loginData);
        this.publicKey = new PublicKey(this.loginData?.public_key!);
        console.log('connect', this.publicKey);
        this.emit('connect', this.publicKey);
    }

    async _connect() {
        const event: PhantomRemoteEvent<void> = await createEventPhantomEvent({type: "connect"});
        const redirectLink = `https://us-central1-nft-bazzar.cloudfunctions.net/resultPhantom/${event.id}`
        console.log(event)
        const url = generateLink('connect', {
            dapp_encryption_public_key: event.phantom_dapp_public_key, 
            host: this.host, 
            redirect_link: redirectLink, 
            cluster: this.network
        })
        console.log(url)
        const dialogData: IDialogPayload = {
            title: "Connect To Wallet",
            description: "Forward to Phantom mobile app to approve NFT bazzar app connection to your Solana Wallet",
            buttonText: "Connect Phantom",
            link: url,
            onClosed: () => {},
        };
        const result = awaitPhantomEventResult<ConnectResult>(this.storage, event.id).then((result) => {
            const loginData: LoginData = {
                public_key: result.decrypted_output_payload.public_key,
                session: result.decrypted_output_payload.session,
                phantom_encryption_public_key: result.phantom_encryption_public_key!,
            }
            localStorage.setItem('_phantomLogin', JSON.stringify(loginData));
            this.loginData = loginData;
            this.publicKey = new PublicKey(loginData.public_key);
            this.emit('connect');
        });
        this.open(dialogData);
        return result.then((value) => {
            this.close()
            return value;
        });
    }

    async disconnect(): Promise<void> {
        if (!this.isConnected) return
        console.log({
            type: "disconnect", 
            phantom_encryption_public_key: this.loginData?.phantom_encryption_public_key,
            payload_to_encrypt: {"session": this.loginData?.session}
        })
        const event: PhantomRemoteEvent<void> = await createEventPhantomEvent({
            type: "disconnect", 
            phantom_encryption_public_key: this.loginData?.phantom_encryption_public_key,
            payload_to_encrypt: {"session": this.loginData?.session}
        });

        const redirectLink = `https://us-central1-nft-bazzar.cloudfunctions.net/resultPhantom/${event.id}`
        console.log(event)
        const url = generatePayloadLink('disconnect', {
            dapp_encryption_public_key: event.phantom_dapp_public_key, 
            redirect_link: redirectLink,
            payload: event.encrypted_input_payload!,
            nonce: event.encrypted_nonce!,
        })
        console.log(url)
        const dialogData: IDialogPayload = {
            title: "Disconnect from Wallet",
            description: "Forward to Phantom mobile app to approve NFT bazzar app invalidate session with Solana Wallet",
            buttonText: "Disconnect",
            link: url,
            onClosed: () => {},
        };
        const promise = awaitPhantomEventResult<DisconnectResult>(this.storage, event.id).then(() => {
            localStorage.removeItem('_phantomLogin');
            this.loginData = undefined;
            this.publicKey = undefined;
            this.emit('disconnect');
        });
        this.open(dialogData);
        return promise.then((value) => {
            this.close()
            return value;
        });
    }

    async signTransaction(transaction: Transaction): Promise<Transaction> {
        const serializedTransaction = bs58.encode(
            transaction.serialize({
              requireAllSignatures: false,
            })
          );
      
          const payload = {
            session: this.loginData?.session,
            transaction: serializedTransaction,
          };
          const event: PhantomRemoteEvent<void> = await createEventPhantomEvent({
            type: "signTransaction", 
            phantom_encryption_public_key: this.loginData?.phantom_encryption_public_key,
            payload_to_encrypt: payload
        });
        const redirectLink = `https://us-central1-nft-bazzar.cloudfunctions.net/resultPhantom/${event.id}`
        console.log(event)
        const url = generatePayloadLink('signTransaction', {
            dapp_encryption_public_key: event.phantom_dapp_public_key, 
            redirect_link: redirectLink,
            payload: event.encrypted_input_payload!,
            nonce: event.encrypted_nonce!,
        })
        console.log(url)
        const dialogData: IDialogPayload = {
            title: "Sign Transaction",
            description: "Forward to Phantom mobile app to sign transaction with Solana Wallet",
            buttonText: 'Sign with Phantom',
            link: url,
            onClosed: () => {},
        };
        const promise = awaitPhantomEventResult<SignResult>(this.storage, event.id).then((result) => {
            console.log(result);
            return Transaction.from(bs58.decode(result.decrypted_output_payload.transaction));
        });
        this.open(dialogData);
        return promise.then((value) => {
            this.close()
            return value;
        });
    }

    async signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
        const encodedTransactions = transactions.map((transaction) => bs58.encode(transaction.serialize({
            requireAllSignatures: false,
          })));
          const payload = {
            session: this.loginData?.session,
            transactions: encodedTransactions,
          };
          const event: PhantomRemoteEvent<void> = await createEventPhantomEvent({
            type: "signAllTransactions", 
            phantom_encryption_public_key: this.loginData?.phantom_encryption_public_key,
            payload_to_encrypt: payload
        });
        const redirectLink = `https://us-central1-nft-bazzar.cloudfunctions.net/resultPhantom/${event.id}`
        console.log(event)
        const url = generatePayloadLink('signAllTransactions', {
            dapp_encryption_public_key: event.phantom_dapp_public_key, 
            redirect_link: redirectLink,
            payload: event.encrypted_input_payload!,
            nonce: event.encrypted_nonce!,
        })
        console.log(url)
        const promise = awaitPhantomEventResult<SignAllResult>(this.storage, event.id).then((result) => {
            console.log(result);
            return result.decrypted_output_payload.transactions.map(transaction => Transaction.from(bs58.decode(transaction)));
        });
        window.open(url, '_blank');
        return promise; 
    }

    async signAndSendTransaction(
        transaction: Transaction,
        options?: SendOptions
    ): Promise<{ signature: TransactionSignature }> {
        const serializedTransaction = bs58.encode(
            transaction.serialize({
              requireAllSignatures: false,
            })
          );
      
          const payload = {
            session: this.loginData?.session,
            transaction: serializedTransaction,
          };
          const event: PhantomRemoteEvent<void> = await createEventPhantomEvent({
            type: "signAndSendTransaction", 
            phantom_encryption_public_key: this.loginData?.phantom_encryption_public_key,
            payload_to_encrypt: payload
        });
        const redirectLink = `https://us-central1-nft-bazzar.cloudfunctions.net/resultPhantom/${event.id}`
        console.log(event)
        const url = generatePayloadLink('signAndSendTransaction', {
            dapp_encryption_public_key: event.phantom_dapp_public_key, 
            redirect_link: redirectLink,
            payload: event.encrypted_input_payload!,
            nonce: event.encrypted_nonce!,
        })
        console.log(url)
        const promise = awaitPhantomEventResult<SignAndSendResult>(this.storage, event.id).then((result) => {
            console.log(result);
            let sub: number = 0;
            return new Promise<{ signature: TransactionSignature }>((resolve, reject) => {
                console.log(`Await processed ${result.decrypted_output_payload.signature}...`)
                sub = this.connection.onSignature(result.decrypted_output_payload.signature, (d, ctx) => {
                    this.connection.removeSignatureListener(sub);
                    console.log(`Processed ${result.decrypted_output_payload.signature}...`)
                    resolve({signature: result.decrypted_output_payload.signature})
                }, 'processed');
            });
        });
        window.open(url, '_blank');
        return promise;
    }

    async signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
        const payload = {
            session: this.loginData?.session,
            message: bs58.encode(message),
          };
          const event: PhantomRemoteEvent<void> = await createEventPhantomEvent({
            type: "signMessage", 
            phantom_encryption_public_key: this.loginData?.phantom_encryption_public_key,
            payload_to_encrypt: payload
        });
        const redirectLink = `https://us-central1-nft-bazzar.cloudfunctions.net/resultPhantom/${event.id}`
        console.log(event)
        const url = generatePayloadLink('signMessage', {
            dapp_encryption_public_key: event.phantom_dapp_public_key, 
            redirect_link: redirectLink,
            payload: event.encrypted_input_payload!,
            nonce: event.encrypted_nonce!,
        })
        console.log(url)
        const promise = awaitPhantomEventResult<SignMessageResult>(this.storage, event.id).then((result) => {
            console.log(result);
            return {signature: bs58.decode(result.decrypted_output_payload.signature)};
        });
        window.open(url, '_blank');
        return promise;
    }
    _handleDisconnect(...args: unknown[]): unknown {
        return null;
    }
}

async function createEventPhantomEvent<T>(eventData: PhantomEventCreate): Promise<PhantomRemoteEvent<T>> {
    const res = await fetch("https://us-central1-nft-bazzar.cloudfunctions.net/createPhantom", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(eventData)
    });
    if (res.status != 200) {
        throw `wrong status ${res.status} ${await res.text()}`;
    }
    const data: PhantomRemoteEvent<T> = await res.json();
    return data;
}

async function awaitPhantomEventResult<T>(fs: Firestore, eventID: string): Promise<PhantomRemoteEvent<T>> {
    let unsub: Unsubscribe;
    const success = new Promise<PhantomRemoteEvent<T>>((resolve) => {
        console.log('waiting...', eventID);
        unsub = onSnapshot(doc(fs, "phantom_events", eventID), (doc) => {
            const event: PhantomRemoteEvent<T> = doc.data() as PhantomRemoteEvent<T>;
            if (!event.is_done) return;
            console.log(event);
            unsub();
            resolve(event);
        })
    });
    return success;
}

