import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";

const prismaClient = new PrismaClient();

const TRENDER_PROGRAM_ID = "9ZFKHrBrA2YC19eLvuCM4kjabjXFqphYJs8PxgeeSG7S";
const HYPE_INSTRUCTION_DISCRIMINATOR = [120, 249, 16, 18, 188, 68, 120, 103];
const UNHYPE_INSTRUCTION_DISCRIMINATOR = [1, 21, 202, 173, 214, 98, 33, 238];

function arraysEqual(a: number[], b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function decodeU64(bytes: Uint8Array, offset: number): bigint {
  let result = BigInt(0);
  for (let i = 0; i < 8; i++) {
    result |= BigInt(bytes[offset + i]) << BigInt(i * 8);
  }
  return result;
}

function decodeU128(bytes: Uint8Array, offset: number): bigint {
  let result = BigInt(0);
  for (let i = 0; i < 16; i++) {
    result |= BigInt(bytes[offset + i]) << BigInt(i * 8);
  }
  return result;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    console.log("Webhook received transaction count:", body.length);
    
    let processedEvents = 0;

    for (const transaction of body) {
      console.log("Processing transaction:", transaction.signature);
      
      if (transaction.instructions && transaction.instructions.length > 0) {
        for (const instruction of transaction.instructions) {
          if (instruction.programId === TRENDER_PROGRAM_ID) {
            console.log("Found Trender program instruction:", instruction.data);
            
            try {
              const instructionData = bs58.decode(instruction.data);
              console.log("Decoded instruction data length:", instructionData.length);
              console.log("First 8 bytes (discriminator):", Array.from(instructionData.slice(0, 8)));
              
              if (arraysEqual(HYPE_INSTRUCTION_DISCRIMINATOR, instructionData.slice(0, 8))) {
                console.log("Detected HYPE instruction");
                
                const amount = decodeU128(instructionData, 8);
                const postId = decodeU64(instructionData, 24);
                const maxAcceptablePrice = decodeU128(instructionData, 32);
                
                console.log("Hype instruction params:", { 
                  amount: amount.toString(), 
                  postId: postId.toString(), 
                  maxAcceptablePrice: maxAcceptablePrice.toString() 
                });

                const timestamp = transaction.timestamp;
                const userPubKey = transaction.feePayer;
                
                let totalCost = 0;
                if (transaction.nativeTransfers && transaction.nativeTransfers.length > 0) {
                  for (const transfer of transaction.nativeTransfers) {
                    if (transfer.fromUserAccount === userPubKey) {
                      totalCost += transfer.amount;
                    }
                  }
                }
                
                const totalCostSOL = totalCost / 1e9;
                const pricePerToken = amount > 0 ? totalCostSOL / Number(amount) : 0;
                
                await prismaClient.event.create({
                  data: {
                    amount: amount,
                    eventType: "HYPE",
                    price: pricePerToken,
                    timestamp: new Date(timestamp * 1000),
                    totalCost: totalCostSOL,
                    postId: Number(postId),
                    userPubKey: userPubKey,
                  },
                });
                processedEvents++;
                console.log("Created HYPE event");
              }
              
              else if (arraysEqual(UNHYPE_INSTRUCTION_DISCRIMINATOR, instructionData.slice(0, 8))) {
                console.log("Detected UNHYPE instruction");
                
                const amount = decodeU128(instructionData, 8);
                const postId = decodeU64(instructionData, 24);
                const minAcceptableRefund = decodeU128(instructionData, 32);
                
                console.log("Unhype instruction params:", { 
                  amount: amount.toString(), 
                  postId: postId.toString(), 
                  minAcceptableRefund: minAcceptableRefund.toString() 
                });
                
                const timestamp = transaction.timestamp;
                const userPubKey = transaction.feePayer;
                
                console.log("Looking for refund transfers for user:", userPubKey);
                console.log("Available nativeTransfers:", transaction.nativeTransfers);
                console.log("Available tokenTransfers:", transaction.tokenTransfers);
                
                let totalRefund = 0;
                if (transaction.nativeTransfers && transaction.nativeTransfers.length > 0) {
                  for (const transfer of transaction.nativeTransfers) {
                    console.log("Checking native transfer:", transfer);
                    if (transfer.toUserAccount === userPubKey) {
                      totalRefund += transfer.amount;
                      console.log("Found refund transfer:", transfer.amount);
                    }
                  }
                }
                
                if (totalRefund === 0 && transaction.tokenTransfers && transaction.tokenTransfers.length > 0) {
                  for (const transfer of transaction.tokenTransfers) {
                    console.log("Checking token transfer:", transfer);
                    if (transfer.toUserAccount === userPubKey) {
                      totalRefund += transfer.tokenAmount || 0;
                      console.log("Found token refund:", transfer.tokenAmount);
                    }
                  }
                }
                
                if (totalRefund === 0 && minAcceptableRefund > 0) {
                  totalRefund = Number(minAcceptableRefund);
                  console.log("No refund found in transfers, using minAcceptableRefund:", minAcceptableRefund.toString());
                }
                
                const totalRefundSOL = totalRefund / 1e9;
                const pricePerToken = amount > 0 ? totalRefundSOL / Number(amount) : 0;
                
                console.log("Final unhype calculation:", {
                  totalRefund,
                  totalRefundSOL,
                  pricePerToken,
                  amount: amount.toString()
                });
                
                await prismaClient.event.create({
                  data: {
                    amount: amount,
                    eventType: "UNHYPE",
                    price: pricePerToken,
                    timestamp: new Date(timestamp * 1000),
                    totalCost: totalRefundSOL,
                    postId: Number(postId),
                    userPubKey: userPubKey,
                  },
                });
                processedEvents++;
                console.log("Created UNHYPE event");
              }
              
            } catch (decodeError) {
              console.error("Error decoding instruction data:", decodeError);
            }
          }
        }
      }

      const logs = transaction.logs || [];
      if (logs.length > 0) {
        console.log("Processing logs as fallback...");
        
        for (const log of logs) {
          if (typeof log === 'string') {
            if (log.includes("Event: HypeEvent") || log.includes("HypeEvent")) {
              const match = log.match(
                /HypeEvent\s*\{\s*post_id:\s*(\d+),\s*user:\s*(\w+),\s*amount:\s*(\d+),\s*price:\s*(\d+),\s*total_cost:\s*(\d+),\s*timestamp:\s*(-?\d+)\s*\}/
              );

              if (match) {
                const [, postId, user, amount, price, totalCost, timestamp] = match;
                console.log("Parsed HypeEvent from logs:", { postId, user, amount, price, totalCost, timestamp });

                await prismaClient.event.create({
                  data: {
                    amount: Number(amount),
                    eventType: "HYPE",
                    price: Number(price) / 1e9,
                    timestamp: new Date(Number(timestamp) * 1000),
                    totalCost: Number(totalCost) / 1e9,
                    postId: Number(postId),
                    userPubKey: user,
                  },
                });
                processedEvents++;
              }
            }

            if (log.includes("Event: UnhypeEvent") || log.includes("UnhypeEvent")) {
              const match = log.match(
                /UnhypeEvent\s*\{\s*post_id:\s*(\d+),\s*user:\s*(\w+),\s*amount:\s*(\d+),\s*price:\s*(\d+),\s*total_refund:\s*(\d+),\s*timestamp:\s*(-?\d+)\s*\}/
              );

              if (match) {
                const [, postId, user, amount, price, totalRefund, timestamp] = match;
                console.log("Parsed UnhypeEvent from logs:", { postId, user, amount, price, totalRefund, timestamp });

                await prismaClient.event.create({
                  data: {
                    amount: Number(amount),
                    eventType: "UNHYPE",
                    price: Number(price) / 1e9,
                    timestamp: new Date(Number(timestamp) * 1000),
                    totalCost: Number(totalRefund) / 1e9,
                    postId: Number(postId),
                    userPubKey: user,
                  },
                });
                processedEvents++;
              }
            }
          }
        }
      }
    }

    console.log(`Processed ${processedEvents} events`);
    return NextResponse.json({ 
      success: true, 
      processedEvents,
      message: `Successfully processed ${processedEvents} events`
    });
  } catch (err) {
    console.error("Error parsing webhook:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
