import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

const prismaClient = new PrismaClient();

export async function GET(req: NextRequest){
    try {
        const postId = req.nextUrl.searchParams.get('postId') || null;
        if (!postId) {
            return NextResponse.json({
                success: false,
                message: 'postId is required',
            }, { status: 400 });
        }
        
        const eventLogs = await prismaClient.event.findMany({
            where: {
                postId: Number(postId)
            }
        });

        const tradeData = eventLogs.map((log) => {
            return {
                time: new Date(log.timestamp).toISOString(),
                open: log.price,
                high: log.price,
                low: log.price,
                close: log.price,
            }
        });

        console.log("tradeData: ", tradeData);

        // prepare kline chart data
        const chartData = [];
        const interval = 5 * 60 * 1000;
        const startTime = tradeData[0]?.time ? new Date(tradeData[0].time).getTime() : 0;
        const endTime = tradeData[tradeData.length - 1]?.time ? new Date(tradeData[tradeData.length - 1].time).getTime() : 0;

        for (let time = startTime; time <= endTime; time += interval) {
            const bucketTrades = tradeData.filter(trade => {
                const tradeTime = new Date(trade.time).getTime();
                return tradeTime >= time && tradeTime < time + interval;
            });

            if (bucketTrades.length > 0) {
                const open = bucketTrades[0].open;
                const close = bucketTrades[bucketTrades.length - 1].close;
                const high = Math.max(...bucketTrades.map(t => t.high));
                const low = Math.min(...bucketTrades.map(t => t.low));

                chartData.push({
                    time: new Date(time).toISOString(),
                    open,
                    high,
                    low,
                    close,
                });
            }

        }

        console.log("chartData: ", chartData);

        return NextResponse.json({
            success: true,
            chartData
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