import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

const prismaClient = new PrismaClient();

// Event discriminators from the IDL
const HYPE_EVENT_DISCRIMINATOR = [152, 5, 87, 176, 166, 250, 159, 73];
const UNHYPE_EVENT_DISCRIMINATOR = [133, 169, 6, 49, 54, 33, 152, 39];

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    console.log("Webhook received:", JSON.stringify(body, null, 2));
    
    let processedEvents = 0;

    for (const transaction of body) {
      console.log("Processing transaction:", transaction.signature);
      console.log("Events object:", transaction.events);
      console.log("Instructions count:", transaction.instructions?.length || 0);
      
      // Check if there are any events in the events object
      if (transaction.events && Object.keys(transaction.events).length > 0) {
        console.log("Found events in events object:", transaction.events);
        
        // Process events from the events object
        for (const [eventType, eventData] of Object.entries(transaction.events)) {
          console.log(`Processing event type: ${eventType}`, eventData);
          // You can add specific event processing logic here
        }
      }

      // Check logs for event information (fallback for different webhook configurations)
      const logs = transaction.logs || [];
      console.log("Logs count:", logs.length);

      for (const log of logs) {
        if (typeof log === 'string') {
          console.log("Processing log:", log);
          
          if (log.includes("Event: HypeEvent") || log.includes("HypeEvent")) {
            const match = log.match(
              /HypeEvent\s*\{\s*post_id:\s*(\d+),\s*user:\s*(\w+),\s*amount:\s*(\d+),\s*price:\s*(\d+),\s*total_cost:\s*(\d+),\s*timestamp:\s*(-?\d+)\s*\}/
            );

            if (match) {
              const [, postId, user, amount, price, totalCost, timestamp] = match;
              console.log("Parsed HypeEvent:", { postId, user, amount, price, totalCost, timestamp });

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
            } else {
              console.log("Could not parse HypeEvent from log:", log);
            }
          }

          if (log.includes("Event: UnhypeEvent") || log.includes("UnhypeEvent")) {
            const match = log.match(
              /UnhypeEvent\s*\{\s*post_id:\s*(\d+),\s*user:\s*(\w+),\s*amount:\s*(\d+),\s*price:\s*(\d+),\s*total_refund:\s*(\d+),\s*timestamp:\s*(-?\d+)\s*\}/
            );

            if (match) {
              const [, postId, user, amount, price, totalRefund, timestamp] = match;
              console.log("Parsed UnhypeEvent:", { postId, user, amount, price, totalRefund, timestamp });

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
            } else {
              console.log("Could not parse UnhypeEvent from log:", log);
            }
          }
        }
      }

      // Check instructions for program interactions
      if (transaction.instructions && transaction.instructions.length > 0) {
        console.log("Checking instructions for program interactions...");
        for (const instruction of transaction.instructions) {
          console.log("Instruction:", instruction);
          // You can add instruction-based event detection here if needed
        }
      }

      // Check account data for state changes
      if (transaction.accountData && transaction.accountData.length > 0) {
        console.log("Account data available, count:", transaction.accountData.length);
        // You can add account data processing here if needed
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
