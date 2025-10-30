import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import idl from "./trender_program.json";

const PROGRAM_ID = new PublicKey("9ZFKHrBrA2YC19eLvuCM4kjabjXFqphYJs8PxgeeSG7S");

export type TrenderProgram = Program<Idl>;

export function getAnchorClient(wallet: any) {
  const connection = new Connection("https://api.devnet.solana.com", {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000,
  });

  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
    commitment: "confirmed",
  });

  const idlWithAddress = {
    ...idl,
    address: PROGRAM_ID.toBase58(),
  } as Idl & { address: string };

  const program = new Program<Idl>(idlWithAddress, provider);

  console.log("Program initialized with ID:", program.programId.toBase58());

  return { program, provider, connection };
}