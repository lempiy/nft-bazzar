import * as anchor from '@project-serum/anchor'
import { Program, Wallet } from '@project-serum/anchor'
import { NftBazzar } from '../target/types/nft_bazzar'
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createInitializeMintInstruction, MINT_SIZE } from '@solana/spl-token' // IGNORE THESE ERRORS IF ANY
import { GetProgramAccountsFilter, Keypair, ParsedAccountData, PublicKey } from '@solana/web3.js'
const { SystemProgram } = anchor.web3


export interface PlayerBet {
  playerAuthority: PublicKey,
  playerAta: PublicKey,
  playerMintKey: PublicKey,
  arbiterAta: PublicKey,
  winnerAta: PublicKey | null,
}

const mintFor = async (authority: Keypair, mintKey: Keypair, program: Program<NftBazzar>): Promise<PublicKey> => {
  // Add your test here.
  console.log('authority', authority.publicKey.toBase58())
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


  const NftTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      authority.publicKey,
  );
  console.log("NFT Account: ", NftTokenAccount.toBase58());

  const mint_tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      }),
      createInitializeMintInstruction(
          mintKey.publicKey,
          0,
          authority.publicKey,
          authority.publicKey
      ),
      createAssociatedTokenAccountInstruction(
          authority.publicKey,
          NftTokenAccount,
          authority.publicKey,
          mintKey.publicKey
      )
  );

  const res = await program.provider.sendAndConfirm(mint_tx, [mintKey, authority]);
  console.log(
      await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
  );

  console.log("Account: ", res);
  console.log("Mint key: ", mintKey.publicKey.toString());
  console.log("User: ", authority.publicKey.toString());

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
            mintAuthority: authority.publicKey,
            mint: mintKey.publicKey,
            tokenAccount: NftTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            metadata: metadataAddress,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            payer: authority.publicKey,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            masterEdition: masterEdition,
          },
      ).signers([authority])
      .rpc();
  console.log("Your transaction signature", tx);
  return NftTokenAccount;
}


const createNewATAInstruction = async (
  payer: PublicKey,
  toWallet: PublicKey,
  mintKey: PublicKey
): Promise<[PublicKey, anchor.web3.TransactionInstruction]> => {
  const toATA = await getAssociatedTokenAddress(mintKey, toWallet);
  return [
    toATA,
    createAssociatedTokenAccountInstruction(payer, toATA, toWallet, mintKey),
  ];
};

const getATAInstructionAndAddress = async (
  provider: anchor.AnchorProvider, 
  owner: PublicKey, 
  payer: PublicKey, 
  mint: PublicKey
  ): Promise<[PublicKey, anchor.web3.TransactionInstruction?]> => {
  const account = await provider.connection.getTokenAccountsByOwner(
    owner,
    {
      mint: mint,
    }
  );
  // The ATA for a token on the to wallet (but might not exist yet)
  return account.value.length
    ? [account.value[0].pubkey]
    : await createNewATAInstruction(payer, owner, mint);
}


describe('nft-bazzar', async () => {
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as Wallet;
  anchor.setProvider(provider);
  const program = anchor.workspace.NftBazzar as Program<NftBazzar>
  const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();
  const multisig = anchor.web3.Keypair.generate();
  const ownerA = anchor.web3.Keypair.generate();
  const ownerB = anchor.web3.Keypair.generate();
  const transaction = anchor.web3.Keypair.generate();
  const [multisigSigner, nonce] = await anchor.web3.PublicKey.findProgramAddress(
    [multisig.publicKey.toBuffer()],
    program.programId
  );
  let NftTokenAccount;
  // it("Mint!", async () => {
  //   // Add your test here.

  //   const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  //       "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  //   );
  //   const lamports: number =
  //       await program.provider.connection.getMinimumBalanceForRentExemption(
  //           MINT_SIZE
  //       );
  //   const getMetadata = async (
  //       mint: anchor.web3.PublicKey
  //   ): Promise<anchor.web3.PublicKey> => {
  //     return (
  //         await anchor.web3.PublicKey.findProgramAddress(
  //             [
  //               Buffer.from("metadata"),
  //               TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //               mint.toBuffer(),
  //             ],
  //             TOKEN_METADATA_PROGRAM_ID
  //         )
  //     )[0];
  //   };

  //   const getMasterEdition = async (
  //       mint: anchor.web3.PublicKey
  //   ): Promise<anchor.web3.PublicKey> => {
  //     return (
  //         await anchor.web3.PublicKey.findProgramAddress(
  //             [
  //               Buffer.from("metadata"),
  //               TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //               mint.toBuffer(),
  //               Buffer.from("edition"),
  //             ],
  //             TOKEN_METADATA_PROGRAM_ID
  //         )
  //     )[0];
  //   };


  //   NftTokenAccount = await getAssociatedTokenAddress(
  //       mintKey.publicKey,
  //       wallet.publicKey
  //   );
  //   console.log("NFT Account: ", NftTokenAccount.toBase58());

  //   const mint_tx = new anchor.web3.Transaction().add(
  //       anchor.web3.SystemProgram.createAccount({
  //         fromPubkey: wallet.publicKey,
  //         newAccountPubkey: mintKey.publicKey,
  //         space: MINT_SIZE,
  //         programId: TOKEN_PROGRAM_ID,
  //         lamports,
  //       }),
  //       createInitializeMintInstruction(
  //           mintKey.publicKey,
  //           0,
  //           wallet.publicKey,
  //           wallet.publicKey
  //       ),
  //       createAssociatedTokenAccountInstruction(
  //           wallet.publicKey,
  //           NftTokenAccount,
  //           wallet.publicKey,
  //           mintKey.publicKey
  //       )
  //   );

  //   const res = await program.provider.sendAndConfirm(mint_tx, [mintKey]);
  //   console.log(
  //       await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
  //   );

  //   console.log("Account: ", res);
  //   console.log("Mint key: ", mintKey.publicKey.toString());
  //   console.log("User: ", wallet.publicKey.toString());

  //   const metadataAddress = await getMetadata(mintKey.publicKey);
  //   const masterEdition = await getMasterEdition(mintKey.publicKey);

  //   console.log("Metadata address: ", metadataAddress.toBase58());
  //   console.log("MasterEdition: ", masterEdition.toBase58());

  //   const tx = await program.methods.mintNft(
  //       mintKey.publicKey,
  //       "https://gist.githubusercontent.com/lempiy/1ab9246af6224bc8a602f70c6691b271/raw/540328c9674e339e96842a8360fe14d4f8c978c7/meme.json",
  //       "Anton First NFT",
  //       "SYMB",
  //   )
  //       .accounts({
  //             mintAuthority: wallet.publicKey,
  //             mint: mintKey.publicKey,
  //             tokenAccount: NftTokenAccount,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             metadata: metadataAddress,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //             payer: wallet.publicKey,
  //             systemProgram: SystemProgram.programId,
  //             rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //             masterEdition: masterEdition,
  //           },
  //       )
  //       .rpc();
  //   console.log("Your transaction signature", tx);
  // });

  it("Sign transaction", async () => {
    const multisigSize = 1000; // Big enough.
    const createAcc = await program.account.game.createInstruction(
      multisig,
      multisigSize
    )
    await program.methods.createGame().accounts({
        game: multisig.publicKey,
        arbiter: wallet.publicKey,
    }).preInstructions([createAcc]).signers([multisig]).rpc();

    let multisigAccount = await program.account.game.fetch(
      multisig.publicKey
    );
    console.log('multisigAccount created...')
  })

  it("Add users", async () => {
    console.log([ownerA.publicKey, ownerB.publicKey])
    const mintA = anchor.web3.Keypair.generate();
    // 1e9 lamports = 10^9 lamports = 1 SOL
    console.log('request drop 1')
    const tx = await provider.connection.requestAirdrop(ownerA.publicKey, 2e9);
    await provider.connection.confirmTransaction(tx);
    const b = await provider.connection.getBalance(ownerA.publicKey)
    console.log(`airdrop 1 ${tx}. balance: ${b}`);
    const mintAccountA = await mintFor(ownerA, mintA, program);

    const [ataA, ataCreateA] = await getATAInstructionAndAddress(provider, wallet.publicKey, wallet.publicKey, mintA.publicKey)
    const instructions = ataCreateA ? [ataCreateA] : []
    console.log('ataA', ataA.toBase58(), ataCreateA)
    await program.methods.addBet().accounts({
        arbiter: wallet.publicKey,
        game: multisig.publicKey,
        arbiterAta: ataA,
        playerAta: mintAccountA,
        playerAuthority: ownerA.publicKey,
        playerMint: mintA.publicKey,
    }).preInstructions(instructions).rpc();
    let multisigAccount = await program.account.game.fetch(
      multisig.publicKey
    );
    console.log('multisigAccount added...', multisigAccount)
    const mintB = anchor.web3.Keypair.generate();
    // 1e9 lamports = 10^9 lamports = 1 SOL
    console.log('transfer to B')
    const transfer = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
          fromPubkey: ownerA.publicKey,
          toPubkey: ownerB.publicKey,
          lamports: 1e9,
      })
  );
      const signature = await anchor.web3.sendAndConfirmTransaction(
        provider.connection,
        transfer,
        [ownerA]
    );
    console.log("SIGNATURE", signature);
    console.log("SUCCESS");


    const b1 = await provider.connection.getBalance(ownerB.publicKey)
    console.log(`airdrop 1 ${signature}. balance: ${b1}`);
    const mintAccountB = await mintFor(ownerB, mintB, program);
    console.log('done');

    const [ataB, ataCreateB] = await getATAInstructionAndAddress(provider, wallet.publicKey, wallet.publicKey, mintB.publicKey)
    const instructionsB = ataCreateB ? [ataCreateB] : []
    console.log('ataB', ataB.toBase58(), ataCreateB)
    await program.methods.addBet().accounts({
        arbiter: wallet.publicKey,
        game: multisig.publicKey,
        arbiterAta: ataB,
        playerAta: mintAccountB,
        playerAuthority: ownerB.publicKey,
        playerMint: mintB.publicKey,
    }).preInstructions(instructionsB).rpc();
    console.log('added');
    let multisigAccount2 = await program.account.game.fetch(
      multisig.publicKey
    );
    console.log('multisigAccount added 2...', multisigAccount2)
  })

  it("create agreement", async () => {
    const [multisigSigner, nonce] =
      await anchor.web3.PublicKey.findProgramAddress(
        [multisig.publicKey.toBuffer()],
        program.programId
      );
    const multisigAccount = await program.account.game.fetch(
      multisig.publicKey
    ) ;

    const txSize = 1000; // Big enough, cuz I'm lazy.
    await program.rpc.createAgreement({
      accounts: {
        game: multisig.publicKey,
        agreement: transaction.publicKey,
        arbiter: multisigAccount.arbiter,
      },
      instructions: [
        await program.account.agreement.createInstruction(
          transaction,
          txSize
        ),
      ],
      signers: [transaction],
    });

    const txAccount = await program.account.agreement.fetch(
      transaction.publicKey
    );
    console.log(txAccount);
    console.log('done');
  })


  it("Approve tx", async () => {
    const multisigAccount = await program.account.game.fetch(
      multisig.publicKey
    );
    const owners = multisigAccount.bets as PlayerBet[];
    // Executes our transfer smart contract 
    console.log('1')
    await program.methods.approveAgreement().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      game: multisig.publicKey,
      authority: ownerA.publicKey,
      to: owners[0].playerAta,
      agreement: transaction.publicKey,
      arbiter: wallet.publicKey,
    }).signers([ownerA]).rpc();
    console.log('2')
    await program.methods.approveAgreement().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      game: multisig.publicKey,
      authority: ownerB.publicKey,
      to: owners[1].playerAta,
      agreement: transaction.publicKey,
      arbiter: wallet.publicKey,
    }).signers([ownerB]).rpc();
    const transactionAccount = await program.account.agreement.fetch(
      transaction.publicKey,
    );
    console.log('approved delegation', transactionAccount)
  })

  it("Execute transaction", async () => {
    // Now that we've reached the threshold, send the transactoin.
    console.log('execute transaction')
    const multisigAccount = await program.account.game.fetch(
      multisig.publicKey
    );

    const owners = multisigAccount.bets as PlayerBet[];
    const tx = new anchor.web3.Transaction();
    const test = owners.map((o) => ({
      pubkey: o.playerAta,
      isWritable: false,
      isSigner: false
    })).concat(owners.map((o) => ({
      pubkey: o.arbiterAta,
      isWritable: false,
      isSigner: false
    })))
    test.forEach(t => console.log('O', t.pubkey.toBase58()))
    
    tx.add(await program.methods.collectLoot().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      game: multisig.publicKey,
      agreement: transaction.publicKey,
      arbiter: wallet.publicKey
    }).remainingAccounts(owners.map((o) => ({
      pubkey: o.playerAta,
      isWritable: true,
      isSigner: false
    })).concat(owners.map((o) => ({
      pubkey: o.arbiterAta,
      isWritable: true,
      isSigner: false
    })))).instruction());

    await provider.sendAndConfirm(tx, []);
   
    
    
    console.log('execute transaction done')
    const txAcc = await program.account.agreement.fetch(transaction.publicKey);
    const filters: GetProgramAccountsFilter[] = [
      {
          dataSize: 165,
      },
      {
          memcmp: {
              offset: 32, //location of our query in the account (bytes)
              bytes: wallet!.publicKey.toBase58(), //our search criteria, a base58 encoded string
          },
      },
  ];
  const acc1= await provider.connection.getParsedAccountInfo(owners[0].arbiterAta);
  const acc2= await provider.connection.getParsedAccountInfo(owners[1].arbiterAta);
   console.log((acc1.value.data as ParsedAccountData).parsed);
   console.log((acc2.value.data as ParsedAccountData).parsed);
  })

  it("Set winner and drop items", async () => {
    const setWinner = await program.methods.setWinner().accounts({
      game: multisig.publicKey,
      winner: ownerB.publicKey,
      arbiter: wallet.publicKey,
    }).instruction();
    const instructions = [setWinner];
    const multisigAccount = await program.account.game.fetch(
      multisig.publicKey
    ) ;
    console.log('1')
    const owners = multisigAccount.bets as PlayerBet[];
    const winnerKeys: {[key: string]: PublicKey} = {};
    await owners.reduce(async (acc, o) => {
      await acc;
      const [ataB, ataCreateB] = await getATAInstructionAndAddress(provider, ownerB.publicKey, wallet.publicKey, o.playerMintKey)
      if (ataCreateB) {
        instructions.push(ataCreateB);
      }
      const setWinnerAta = await program.methods.setWinnerAccount().accounts({
        game: multisig.publicKey,
        winnerAssociatedToken: ataB,
        trophy: o.playerMintKey,
        arbiter: wallet.publicKey,
      }).instruction();
      console.log('2', o)
      instructions.push(setWinnerAta)
      winnerKeys[o.playerMintKey.toBase58()] = ataB;
      return Promise.resolve()
    }, Promise.resolve())
    console.log('3', instructions.length)
    const game = await program.account.game.fetch(
      multisig.publicKey
    );
    const owners2 = game.bets as PlayerBet[];
    console.log('))', ownerA.publicKey.toBase58())
    console.log('))', ownerB.publicKey.toBase58())
    owners2.map((o) => ({
      pubkey: o.arbiterAta,
      isWritable: true,
      isSigner: false
    })).forEach((c) => console.log('', c.pubkey.toBase58()));
    owners2.map((o) => ({
      pubkey: winnerKeys[o.playerMintKey.toBase58()],
      isWritable: true,
      isSigner: false
    })).forEach((c) => console.log('>>', c.pubkey.toBase58()));
    const dropInstr = await program.methods.dropLoot().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      game: multisig.publicKey,
      agreement: transaction.publicKey,
      arbiter: wallet.publicKey
    }).remainingAccounts(
      owners2.map((o) => ({
        pubkey: o.arbiterAta,
        isWritable: true,
        isSigner: false
      })).concat(owners2.map((o) => ({
        pubkey: winnerKeys[o.playerMintKey.toBase58()],
        isWritable: true,
        isSigner: false
      })))
    ).instruction();
    instructions.push(dropInstr);
    const tx = new anchor.web3.Transaction();
    tx.add(...instructions)
    const id = await provider.sendAndConfirm(tx, [wallet.payer], {
      skipPreflight: true,
    });
    console.log('4')
    console.log('done...')
    console.log(await program.account.game.fetch(
      multisig.publicKey
    ));
    console.log(id)
  })

  // it("Transfer approved", async () => {
  //   const myWallet = anchor.AnchorProvider.env().wallet.publicKey;
      // const toATA = await getAssociatedTokenAddress(
      //   mintKey.publicKey,
      //   multisig.publicKey
      // );

      // // Fires a list of instructions
      // const mint_tx = new anchor.web3.Transaction().add(
      //   // Create the ATA account that is associated with our To wallet
      //   createAssociatedTokenAccountInstruction(
      //     myWallet, toATA, multisig.publicKey, mintKey.publicKey
      //   )
      // );

  //     console.log('1')

  //     // Sends and create the transaction
  //     await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);
  //     console.log('2')
  //     // Executes our transfer smart contract 
  //     await program.methods.transferToken().accounts({
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       from: NftTokenAccount,
  //       fromAuthority: multisig.publicKey,
  //       to: toATA,
  //     }).signers([multisig]).rpc();
  //     console.log('3')
  //     // Get minted token amount on the ATA for our anchor wallet
  //     const minted = (await program.provider.connection.getParsedAccountInfo(NftTokenAccount)).value.data as ParsedAccountData;
  //     console.log('source:', minted.parsed);
  //     const minted2 = (await program.provider.connection.getParsedAccountInfo(toATA)).value.data as ParsedAccountData;
  //     console.log('dest:', minted2.parsed);
  // })


// ////////////////////////////// =================== //////////

//   it("Transfer token", async () => {
//     // Get anchor's wallet's public key
//     const myWallet = anchor.AnchorProvider.env().wallet.publicKey;
//     // Wallet that will receive the token 
//     const toWallet: anchor.web3.Keypair = anchor.web3.Keypair.generate();
//     // The ATA for a token on the to wallet (but might not exist yet)
    // const toATA = await getAssociatedTokenAddress(
    //   mintKey.publicKey,
    //   toWallet.publicKey
    // );

//     // Fires a list of instructions
    // const mint_tx = new anchor.web3.Transaction().add(
    //   // Create the ATA account that is associated with our To wallet
    //   createAssociatedTokenAccountInstruction(
    //     myWallet, toATA, toWallet.publicKey, mintKey.publicKey
    //   )
    // );

//     console.log('1')

//     // Sends and create the transaction
//     await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);
//     console.log('2')
//     // Executes our transfer smart contract 
//     await program.methods.transferToken().accounts({
//       tokenProgram: TOKEN_PROGRAM_ID,
//       from: NftTokenAccount,
//       fromAuthority: myWallet,
//       to: toATA,
//     }).rpc();
//     console.log('3')
//     // Get minted token amount on the ATA for our anchor wallet
//     const minted = (await program.provider.connection.getParsedAccountInfo(NftTokenAccount)).value.data;
//     console.log(minted);
//   });
  // let acc: anchor.web3.PublicKey;
  // it("Create match", async () => {
  //   const myWallet = wallet.publicKey;
  //   console.log(myWallet.toBase58());
  //   const pk: anchor.web3.Keypair = anchor.web3.Keypair.generate();
  //   console.log('here');
  //   await program.methods.createMatch().accounts({
  //     data: pk.publicKey,
  //     arbiter: myWallet
  //   }).signers([pk]).rpc();
  //   acc = pk.publicKey;
  //   console.log(acc.toBase58());
  // });
  // it("Add player", async () => {
  //   const data = await program.account.matchData.fetch(new PublicKey("2DUgdCikG2y4UoBdGCvNsJ3RPDaR25T3sRo3SxGJo1t5"));
  //   console.log(data);
  // });
});