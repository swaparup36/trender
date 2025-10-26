import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

const prismaClient = new PrismaClient();

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    console.log("body: ", body);
    for (const event of body) {
      const logs = event.logs || [];

      for (const log of logs) {
        if (log.includes("Event: HypeEvent")) {
          // Extract the values (you can improve this with regex parsing)
          const match = log.match(
            /HypeEvent\s*\{\s*post:\s*(\w+),\s*user:\s*(\w+),\s*amount:\s*(\d+),\s*price:\s*(\d+),\s*total_cost:\s*(\d+),\s*timestamp:\s*(-?\d+)\s*\}/
          );

          if (match) {
            const [, post, user, amount, price, totalCost, timestamp] = match;

            await prismaClient.event.create({
              data: {
                amount: Number(amount),
                eventType: "HYPE",
                price: Number(price) / 1e9,
                timestamp: new Date(Number(timestamp) * 1000),
                totalCost: Number(totalCost) / 1e9,
                postId: post,
                userPubKey: user,
              },
            });
          }
        }

        if (log.includes("Event: UnhypeEvent")) {
          const match = log.match(
            /UnhypeEvent\s*\{\s*post:\s*(\w+),\s*user:\s*(\w+),\s*amount:\s*(\d+),\s*price:\s*(\d+),\s*total_refund:\s*(\d+),\s*timestamp:\s*(-?\d+)\s*\}/
          );

          if (match) {
            const [, post, user, amount, price, totalRefund, timestamp] = match;

            await prismaClient.event.create({
              data: {
                amount: Number(amount),
                eventType: "UNHYPE",
                price: Number(price) / 1e9,
                timestamp: new Date(Number(timestamp) * 1000),
                totalCost: Number(totalRefund) / 1e9,
                postId: post,
                userPubKey: user,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error parsing webhook:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
