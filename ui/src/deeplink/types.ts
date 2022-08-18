import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PublicKey, Transaction } from '@solana/web3.js'

export interface PhantomRemoteEvent<T> {
    id: string,
    is_done: boolean,
    type: string,
    created_at: Date,
    phantom_dapp_public_key: string,
    phantom_encryption_public_key?: string,
    encrypted_input_payload?: string,
    decrypted_output_payload: T
    encrypted_nonce?: string,
}

export interface PhantomEventCreate {
    type: string
    phantom_encryption_public_key?: string
    payload_to_encrypt?: unknown
}

export type DisplayEncoding = 'utf8' | 'hex'
export type PhantomEvent = 'disconnect' | 'connect' | 'accountChanged'
export type PhantomRequestMethod =
    | 'connect'
    | 'disconnect'
    | 'signTransaction'
    | 'signAllTransactions'
    | 'signMessage'

export interface ConnectOpts {
    onlyIfTrusted: boolean
}

export interface PhantomProvider {
    publicKey: PublicKey | null
    isConnected: boolean | null
    signTransaction: (transaction: Transaction) => Promise<Transaction>
    signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>
    signMessage: (
        message: Uint8Array | string,
        display?: DisplayEncoding
    ) => Promise<any>
    connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>
    disconnect: () => Promise<void>
    on: (event: PhantomEvent, handler: (args: any) => void) => void
    request: (method: PhantomRequestMethod, params: any) => Promise<unknown>
}

export type PhantomCluster = 'mainnet-beta' | 'testnet' | 'devnet'
export const getSolanaEndpoint = (network: WalletAdapterNetwork) => {
    switch (network) {
        case WalletAdapterNetwork.Devnet: return 'https://api.devnet.solana.com';
        case WalletAdapterNetwork.Testnet: return 'https://api.testnet.solana.com'; 
        default: return 'https://api.mainnet-beta.solana.com'
    }
}
