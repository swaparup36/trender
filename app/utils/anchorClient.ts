import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import idl from "./trender_program.json";

// Must match the declare_id!() in your Rust program
const PROGRAM_ID = new PublicKey("9ZFKHrBrA2YC19eLvuCM4kjabjXFqphYJs8PxgeeSG7S");

// Define the program type based on your IDL
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

  // Create IDL object ensuring address is explicitly set
  const idlWithAddress = {
    ...idl,
    address: PROGRAM_ID.toBase58(),
  } as Idl & { address: string };

  // Log for debugging
  // console.log("Program ID being used:", PROGRAM_ID.toBase58());
  // console.log("IDL address:", (idl as any).address);

  const program = new Program<Idl>(idlWithAddress, provider);

  console.log("Program initialized with ID:", program.programId.toBase58());

  return { program, provider, connection };
}