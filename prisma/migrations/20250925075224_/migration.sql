/*
  Warnings:

  - You are about to drop the column `ownerComment` on the `evaluation` table. All the data in the column will be lost.
  - You are about to drop the column `ownerSignedAt` on the `evaluation` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `Evaluation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `evaluation` DROP COLUMN `ownerComment`,
    DROP COLUMN `ownerSignedAt`,
    ADD COLUMN `createdById` INTEGER NOT NULL,
    ADD COLUMN `managerSignature` LONGBLOB NULL,
    ADD COLUMN `mdSignature` LONGBLOB NULL,
    ADD COLUMN `submitterComment` VARCHAR(191) NULL,
    ADD COLUMN `submitterSignature` LONGBLOB NULL,
    ADD COLUMN `submitterSignedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Evaluation_createdById_idx` ON `Evaluation`(`createdById`);

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
