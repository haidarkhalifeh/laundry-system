/*
  Warnings:

  - A unique constraint covering the columns `[itemId,serviceTypeId]` on the table `ItemPrice` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ItemPrice_itemId_serviceTypeId_key" ON "ItemPrice"("itemId", "serviceTypeId");
