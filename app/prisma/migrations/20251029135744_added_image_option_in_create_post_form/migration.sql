/*
  Warnings:

  - You are about to drop the `Orders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Orders" DROP CONSTRAINT "Orders_postId_fkey";

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "imageUrl" TEXT;

-- DropTable
DROP TABLE "public"."Orders";

-- DropEnum
DROP TYPE "public"."OrderType";
