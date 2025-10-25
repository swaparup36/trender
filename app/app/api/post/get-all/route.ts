import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

const prismaClient = new PrismaClient();

export async function GET(req: NextRequest){
    try {
        const allPosts = await prismaClient.post.findMany({});

        return NextResponse.json({
            success: true,
            allPosts
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