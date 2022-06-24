import * as anchor from '@project-serum/anchor'
import { Program, Wallet } from '@project-serum/anchor'
import { NftBazzar } from '../target/types/nft_bazzar'
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createInitializeMintInstruction, MINT_SIZE } from '@solana/spl-token' // IGNORE THESE ERRORS IF ANY
const { SystemProgram } = anchor.web3

describe('nft-bazzar', () => {
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as Wallet;
  anchor.setProvider(provider);
  const program = anchor.workspace.NftBazzar as Program<NftBazzar>
  const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();
  let NftTokenAccount;
  it("Mint!", async () => {
    // Add your test here.

    const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    );
    const lamports: number =
        await program.provider.connection.getMinimumBalanceForRentExemption(
            MINT_SIZE
        );
    const getMetadata = async (
        mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
      return (
          await anchor.web3.PublicKey.findProgramAddress(
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
        mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
      return (
          await anchor.web3.PublicKey.findProgramAddress(
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


    NftTokenAccount = await getAssociatedTokenAddress(
        mintKey.publicKey,
        wallet.publicKey
    );
    console.log("NFT Account: ", NftTokenAccount.toBase58());

    const mint_tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKey.publicKey,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
          lamports,
        }),
        createInitializeMintInstruction(
            mintKey.publicKey,
            0,
            wallet.publicKey,
            wallet.publicKey
        ),
        createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            NftTokenAccount,
            wallet.publicKey,
            mintKey.publicKey
        )
    );

    const res = await program.provider.sendAndConfirm(mint_tx, [mintKey]);
    console.log(
        await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
    );

    console.log("Account: ", res);
    console.log("Mint key: ", mintKey.publicKey.toString());
    console.log("User: ", wallet.publicKey.toString());

    const metadataAddress = await getMetadata(mintKey.publicKey);
    const masterEdition = await getMasterEdition(mintKey.publicKey);

    console.log("Metadata address: ", metadataAddress.toBase58());
    console.log("MasterEdition: ", masterEdition.toBase58());

    const tx = await program.methods.mintNft(
        mintKey.publicKey,
        "https://gist.githubusercontent.com/lempiy/1ab9246af6224bc8a602f70c6691b271/raw/540328c9674e339e96842a8360fe14d4f8c978c7/meme.json",
        "Anton First NFT",
        "SYMB",
    )
        .accounts({
              mintAuthority: wallet.publicKey,
              mint: mintKey.publicKey,
              tokenAccount: NftTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
              metadata: metadataAddress,
              tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
              payer: wallet.publicKey,
              systemProgram: SystemProgram.programId,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
              masterEdition: masterEdition,
            },
        )
        .rpc();
    console.log("Your transaction signature", tx);
  });


////////////////////////////// =================== //////////

  it("Transfer token", async () => {
    // Get anchor's wallet's public key
    const myWallet = anchor.AnchorProvider.env().wallet.publicKey;
    // Wallet that will receive the token 
    const toWallet: anchor.web3.Keypair = anchor.web3.Keypair.generate();
    // The ATA for a token on the to wallet (but might not exist yet)
    const toATA = await getAssociatedTokenAddress(
      mintKey.publicKey,
      toWallet.publicKey
    );

    // Fires a list of instructions
    const mint_tx = new anchor.web3.Transaction().add(
      // Create the ATA account that is associated with our To wallet
      createAssociatedTokenAccountInstruction(
        myWallet, toATA, toWallet.publicKey, mintKey.publicKey
      )
    );

    console.log('1')

    // Sends and create the transaction
    await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);
    console.log('2')
    // Executes our transfer smart contract 
    await program.methods.transferToken().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      from: NftTokenAccount,
      fromAuthority: myWallet,
      to: toATA,
    }).rpc();
    console.log('3')
    // Get minted token amount on the ATA for our anchor wallet
    const minted = (await program.provider.connection.getParsedAccountInfo(NftTokenAccount)).value.data;
    console.log(minted);
  });
});