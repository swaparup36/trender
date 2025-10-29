import { PrismaClient } from "@/lib/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

const prismaClient = new PrismaClient();

export async function POST(req: NextRequest){
    const body = await req.json();
    try {
        const { userPubKey, title, content, imageUrl } = body;
        if (!userPubKey || !title || !content) {
            return NextResponse.json({
                success: false,
                message: 'missing parameters'
            }, { status: 500 });
        }

        const post = await prismaClient.post.create({
            data: {
                userPubKey,
                title,
                content,
                imageUrl: imageUrl || null,
            }
        });

        return NextResponse.json({
            success: true,
            post
        });
    } catch (error) {
        const err = error as Error;
        console.log('post creation err: ', err.message);

        return NextResponse.json({
            success: false,
            message: 'error occured on post creation',
        }, { status: 500 });
    }
}