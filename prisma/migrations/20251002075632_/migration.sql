/*
  Warnings:

  - You are about to alter the column `code` on the `department` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(32)`.
  - You are about to alter the column `nameTh` on the `department` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `nameEn` on the `department` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `code` on the `evalcycle` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(64)`.
  - You are about to alter the column `code` on the `organization` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(32)`.
  - You are about to alter the column `nameTh` on the `organization` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `nameEn` on the `organization` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `fromName` on the `positionchangelog` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `toName` on the `positionchangelog` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `name` on the `role` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `labelTh` on the `role` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `labelEn` on the `role` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `name` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(160)`.
  - You are about to alter the column `email` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(160)`.
  - You are about to alter the column `firstNameTh` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `lastNameTh` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `firstNameEn` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `lastNameEn` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.
  - You are about to alter the column `employeeCode` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(32)`.
  - You are about to alter the column `positionName` on the `userdepartment` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(120)`.

*/
-- DropForeignKey
ALTER TABLE `evaluation` DROP FOREIGN KEY `Evaluation_cycleId_fkey`;

-- DropForeignKey
ALTER TABLE `positionchangelog` DROP FOREIGN KEY `PositionChangeLog_userId_fkey`;

-- DropForeignKey
ALTER TABLE `userdepartment` DROP FOREIGN KEY `UserDepartment_userId_fkey`;

-- AlterTable
ALTER TABLE `department` MODIFY `code` VARCHAR(32) NOT NULL,
    MODIFY `nameTh` VARCHAR(120) NOT NULL,
    MODIFY `nameEn` VARCHAR(120) NOT NULL;

-- AlterTable
ALTER TABLE `evalcycle` MODIFY `code` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `organization` MODIFY `code` VARCHAR(32) NOT NULL,
    MODIFY `nameTh` VARCHAR(120) NOT NULL,
    MODIFY `nameEn` VARCHAR(120) NOT NULL;

-- AlterTable
ALTER TABLE `passwordreset` MODIFY `token` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `positionchangelog` MODIFY `fromName` VARCHAR(120) NULL,
    MODIFY `toName` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `role` MODIFY `name` VARCHAR(50) NOT NULL,
    MODIFY `labelTh` VARCHAR(120) NOT NULL,
    MODIFY `labelEn` VARCHAR(120) NOT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lockedUntil` DATETIME(3) NULL,
    MODIFY `name` VARCHAR(160) NOT NULL DEFAULT '',
    MODIFY `email` VARCHAR(160) NOT NULL,
    MODIFY `passwordHash` VARCHAR(255) NOT NULL,
    MODIFY `firstNameTh` VARCHAR(120) NOT NULL,
    MODIFY `lastNameTh` VARCHAR(120) NOT NULL,
    MODIFY `firstNameEn` VARCHAR(120) NOT NULL,
    MODIFY `lastNameEn` VARCHAR(120) NOT NULL,
    MODIFY `employeeCode` VARCHAR(32) NULL,
    MODIFY `avatarPath` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `userdepartment` MODIFY `positionName` VARCHAR(120) NULL;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jti` VARCHAR(64) NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `replacedBy` VARCHAR(64) NULL,

    UNIQUE INDEX `RefreshToken_jti_key`(`jti`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    INDEX `RefreshToken_revoked_idx`(`revoked`),
    INDEX `RefreshToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `EvalCycle_isActive_idx` ON `EvalCycle`(`isActive`);

-- CreateIndex
CREATE INDEX `Evaluation_ownerId_status_idx` ON `Evaluation`(`ownerId`, `status`);

-- CreateIndex
CREATE INDEX `User_email_deletedAt_idx` ON `User`(`email`, `deletedAt`);

-- AddForeignKey
ALTER TABLE `UserDepartment` ADD CONSTRAINT `UserDepartment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `PositionChangeLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `EvalCycle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
