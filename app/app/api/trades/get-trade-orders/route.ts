import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

const prismaClient = new PrismaClient();

export async function GET(req: NextRequest){
    try {
        const postId = req.nextUrl.searchParams.get('postId') || null;
        const userPubKey = req.nextUrl.searchParams.get('userPubKey') || null;
        const eventType = req.nextUrl.searchParams.get('eventType') || null;

        if (!postId || !userPubKey || !eventType) {
            return NextResponse.json({
                success: false,
                message: 'postId is required',
            }, { status: 400 });
        }

        if (eventType !== 'HYPE' && eventType !== 'UNHYPE') {
            return NextResponse.json({
                success: false,
                message: 'invalid eventType',
            }, { status: 400 });
        }

        const eventLogs = await prismaClient.event.findMany({
            where: {
                postId: Number(postId),
                userPubKey: userPubKey,
                eventType: eventType,
            },
            orderBy: {
                timestamp: 'desc',
            }
        });

        const tradeData = eventLogs.map((log) => {
            return {
                userPubKey: log.userPubKey,
                postId: log.postId,
                orderType: log.eventType === 'HYPE' ? 'BUY' : 'SELL',
                amount: typeof log.amount === 'bigint' ? Number(log.amount) : log.amount,
                price: typeof log.price === 'bigint' ? Number(log.price) : log.price,
                totalCost: typeof log.totalCost === 'bigint' ? Number(log.totalCost) : log.totalCost,
                time: new Date(log.timestamp).toISOString(),
            }
        });

        return NextResponse.json({
            success: true,
            tradeData: tradeData
        });
    } catch (error) {
        const err = error as Error;
        console.log('get trade data err: ', err.message);

        return NextResponse.json({
            success: false,
            message: 'error occured on get trade data',
        }, { status: 500 });
    }
}