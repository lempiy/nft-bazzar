import { Firestore } from "@google-cloud/firestore";
export const SOLANA_URL = "https://api.devnet.solana.com";

export const fs = new Firestore({
  projectId: process.env.GCLOUD_PROJECT,
  timestampsInSnapshots: true,
  keyFilename: "/secret/db-service-account-key/db-service-account-key",
});
