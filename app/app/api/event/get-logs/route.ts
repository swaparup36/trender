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

        return NextResponse.json({
            success: true,
            eventLogs: eventLogs,
        });
    } catch (error) {
        const err = error as Error;
        console.log('redis err: ', err.message);

        return NextResponse.json({
            success: false,
            message: 'error occured redis',
        }, { status: 500 });
    }
}