import { Firestore } from "@google-cloud/firestore";
export const SOLANA_URL = "https://api.devnet.solana.com";
export const PHANTOM_DAPP_PUBLIC_KEY = process.env.PHANTOM_DAPP_PUBLIC_KEY;
export const PHANTOM_DAPP_SECRET_KEY = process.env.PHANTOM_DAPP_SECRET_KEY;


export const fs = new Firestore({
  projectId: process.env.GCLOUD_PROJECT,
  timestampsInSnapshots: true,
  keyFilename: "/secret/db-service-account-key/db-service-account-key",
});

export const PHANTOM_TEMPLATE_REPLY = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PHANTOM RESULT</title>
    </head>
    <body>
        <h5>{{ANSWER}}</h5>
        <script>
            setTimeout(() => {
                window.close();
            }, 3000)
        </script>
    </body>
</html>`;
export const PHANTOM_SUCCESS_REPLY = PHANTOM_TEMPLATE_REPLY.replace(`{{ANSWER}}`, 'SUCCESS');
