import { createContext } from "react";
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { create } from "ipfs-http-client";
import { web3 } from "@project-serum/anchor";

export interface IStore {
    user: IUser
    nfts: INFT[]
    loading: boolean
}

export interface INFT {
    account_id: string
    owner: string
    authority: string
    mint_key: string
    mint_tx_id: string
    meta: NFTMeta
    meta_url: string
}

export interface IUser {
    id: string,
}

const initialState = {
    user: {
        id: ""
    },
    nfts: [],
    loading: false,
}

export const getNFTMetaData = (title: string, desc: string, url: string, author: string): NFTMeta => ({
    "name": title,
    "symbol": "NFTB",
    "description": desc,
    "seller_fee_basis_points": 1,
    "external_url":"",
    "edition":"2022",
    "background_color":"000000",
    "attributes":[
       {
          "trait_type":"Background",
          "value":"Black / Red"
       },
       {
          "trait_type":"Source",
          "value":"TV Show"
       },
       {
          "display_type":"number",
          "trait_type":"generation",
          "value":1
       },
       {
          "display_type":"number",
          "trait_type":"sequence",
          "value":236
       }
    ],
    "properties":{
       "category":"image",
       "creators":[
          {
             "address": author,
             "share":100
          }
       ],
       "files":[
          {
             "uri": url,
             "type":"image/jpg"
          }
       ]
    },
    "image": url
 })

export const context = createContext<IStore>(initialState);

export const toFile = (name: string, source: Object): File => {
    const json = JSON.stringify(source);
    
    const blob = new Blob([json], {type: "application/json"});
    return new File([blob], name, {
        type: "application/json"
    })
}

export const client = create({url: 'https://ipfs.infura.io:5001/api/v0'})
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDS7dU38ht4Q7vLjrF1ahwZnDvYL6OfpFk",
  authDomain: "nft-bazzar.firebaseapp.com",
  projectId: "nft-bazzar",
  storageBucket: "nft-bazzar.appspot.com",
  messagingSenderId: "507068306037",
  appId: "1:507068306037:web:beed7339f7bca75ce25e3c",
  measurementId: "G-S8D2F1RLB9"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    //"6J6CVjkVLq23dCYB9vWzz87sBrqa9B7bcB57Q4n8Sew8"
);


export interface Attribute {
   trait_type: string;
   value?: any;
   display_type?: string;
}

export interface Creator {
   address: string;
   share: number;
}

export interface IFile {
   uri: string;
   type: string;
}

export interface Properties {
   category: string;
   creators: Creator[];
   files: IFile[];
}

export interface NFTMeta {
   name: string;
   symbol: string;
   description: string;
   seller_fee_basis_points: number;
   external_url: string;
   edition: string;
   background_color: string;
   attributes: Attribute[];
   properties: Properties;
   image: string;
}
