import {
  fs,
  PHANTOM_DAPP_PUBLIC_KEY,
  PHANTOM_DAPP_SECRET_KEY,
} from "../contants";
import bs58 from "bs58";
import nacl from "tweetnacl";
import base58 from "bs58";

interface ICreateEvent {
  type: string;
  phantom_encryption_public_key?: string;
  payload_to_encrypt?: unknown;
}

interface Event {
  is_done: boolean;
  type: string;
  created_at: number;
  phantom_dapp_public_key: string;
  phantom_encryption_public_key: string | null;
  decrypted_output_payload?: { [key: string]: unknown };
  encrypted_input_payload?: string;
  encrypted_nonce?: string;
}

type PhantomReply = {
  phantom_encryption_public_key?: string;
  nonce?: string;
  data?: string;
  errorCode?: string;
  errorMessage?: string;
  [key: string]: unknown;
};

export const createPhantomEvent = async (payload: ICreateEvent) => {
  const phantomEvents = fs.collection("phantom_events");
  const doc: Event = {
    is_done: false,
    type: payload.type,
    phantom_dapp_public_key: PHANTOM_DAPP_PUBLIC_KEY!,
    phantom_encryption_public_key:
      payload.phantom_encryption_public_key || null,
    created_at: Date.now(),
  };
  if (payload.phantom_encryption_public_key && payload.payload_to_encrypt) {
    const { nonce, encrypted_payload } = encryptPhantomPayload({
      phantom_encryption_public_key: payload.phantom_encryption_public_key,
      payload: payload.payload_to_encrypt,
    });
    doc.encrypted_nonce = nonce;
    doc.encrypted_input_payload = encrypted_payload;
  }
  console.log(doc);
  const result = await phantomEvents.add(doc);
  console.log({ id: result.id, ...doc });
  return { id: result.id, ...doc };
};

export const onEventResult = async (id: string, reply: PhantomReply) => {
  console.log(id, reply);
  if (reply.errorCode) {
    throw `${reply.errorCode}: ${reply.errorMessage}`
  }
  const phantomEvents = fs.collection("phantom_events");
  const doc = await phantomEvents.doc(id).get();
  if (!doc.exists) {
    throw `undefined event ${id}`;
  }
  const data = doc.data() as Event;
  const phantom_encryption_public_key =
    reply.phantom_encryption_public_key || data.phantom_encryption_public_key;
  await phantomEvents.doc(id).update({
    is_done: true,
    decrypted_output_payload: reply.data ? decryptReply(phantom_encryption_public_key!, reply) : null,
    phantom_encryption_public_key,
  });
};

const decryptReply = (phantom_encryption_public_key: string, reply: PhantomReply): unknown => {
    const secret = base58.decode(PHANTOM_DAPP_SECRET_KEY!);
    console.log(phantom_encryption_public_key);
    const sharedSecretDapp = nacl.box.before(
        bs58.decode(phantom_encryption_public_key!),
        secret
    );
    console.log(`sharedSecretDapp`, bs58.encode(sharedSecretDapp));
    const resultData = decryptPayload(reply.data!, reply.nonce!, sharedSecretDapp);
    console.log(`resultData`, resultData);
    return resultData;
}

interface EncryptPayloadRequest {
  phantom_encryption_public_key: string;
  payload: unknown;
}

interface EncryptPayloadResponse {
  nonce: string;
  encrypted_payload: string;
}

const encryptPhantomPayload = (
  input: EncryptPayloadRequest
): EncryptPayloadResponse => {
  const secret = base58.decode(PHANTOM_DAPP_SECRET_KEY!);
  const sharedSecretDapp = nacl.box.before(
    bs58.decode(input.phantom_encryption_public_key),
    secret
  );
  const [nonce, encrypted_payload] = encryptPayload(
    input.payload,
    sharedSecretDapp
  );
  return {
    nonce: bs58.encode(nonce),
    encrypted_payload: bs58.encode(encrypted_payload),
  };
};

const decryptPayload = (
  data: string,
  nonce: string,
  sharedSecret?: Uint8Array
) => {
  if (!sharedSecret) throw new Error("missing shared secret");

  const decryptedData = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    sharedSecret
  );
  if (!decryptedData) {
    throw new Error("Unable to decrypt data");
  }
  return JSON.parse(Buffer.from(decryptedData).toString("utf8"));
};

const encryptPayload = (payload: unknown, sharedSecret?: Uint8Array) => {
  if (!sharedSecret) throw new Error("missing shared secret");

  const nonce = nacl.randomBytes(24);

  const encryptedPayload = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    sharedSecret
  );

  return [nonce, encryptedPayload];
};
