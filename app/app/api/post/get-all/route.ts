import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

const prismaClient = new PrismaClient();

export async function GET(req: NextRequest){
    try {
        const allPosts = await prismaClient.post.findMany({
            orderBy: {
                publishedAt: 'desc'
            }
        });

        return NextResponse.json({
            success: true,
            allPosts
        });
    } catch (error) {
        const err = error as Error;
        console.log('get all posts err: ', err.message);

        return NextResponse.json({
            success: false,
            message: 'error occured getting all posts',
        }, { status: 500 });
    }
}