import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

const prismaClient = new PrismaClient();

export async function GET(req: NextRequest){
    try {
        const userPubKey = req.nextUrl.searchParams.get('userPubKey') || null;
        if (!userPubKey) {
            return NextResponse.json({
                success: false,
                message: 'userPubKey is required',
            }, { status: 400 });
        }


        const allPosts = await prismaClient.post.findMany({
            where: {
                userPubKey: userPubKey
            }
        });

        return NextResponse.json({
            success: true,
            allPosts
        });
    } catch (error) {
        const err = error as Error;
        console.log('get posts by user err: ', err.message);

        return NextResponse.json({
            success: false,
            message: 'error occured on getting posts by user',
        }, { status: 500 });
    }
}
