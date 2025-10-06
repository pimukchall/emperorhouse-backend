/*
  Warnings:

  - The values [STAF] on the enum `PositionChangeLog_toLevel` will be removed. If these variants are still used in the database, this will fail.
  - The values [STAF] on the enum `PositionChangeLog_toLevel` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `failedLoginAttempts` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `lockedUntil` on the `user` table. All the data in the column will be lost.
  - The values [STAF] on the enum `PositionChangeLog_toLevel` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[code,deletedAt]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employeeCode,deletedAt]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `Organization_code_key` ON `organization`;

-- DropIndex
DROP INDEX `PasswordReset_token_idx` ON `passwordreset`;

-- DropIndex
DROP INDEX `User_email_deletedAt_idx` ON `user`;

-- DropIndex
DROP INDEX `User_email_key` ON `user`;

-- DropIndex
DROP INDEX `User_employeeCode_key` ON `user`;

-- DropIndex
DROP INDEX `UserDepartment_startedAt_idx` ON `userdepartment`;

-- AlterTable
ALTER TABLE `evaluation` MODIFY `s1_responsibility` DECIMAL(5, 2) NULL,
    MODIFY `s1_development` DECIMAL(5, 2) NULL,
    MODIFY `s1_workload` DECIMAL(5, 2) NULL,
    MODIFY `s1_qualityStandard` DECIMAL(5, 2) NULL,
    MODIFY `s1_coordination` DECIMAL(5, 2) NULL,
    MODIFY `s2_valueOfWork` DECIMAL(5, 2) NULL,
    MODIFY `s2_customerSatisfaction` DECIMAL(5, 2) NULL,
    MODIFY `s2_costEffectiveness` DECIMAL(5, 2) NULL,
    MODIFY `s2_timeliness` DECIMAL(5, 2) NULL,
    MODIFY `s3_jobKnowledge` DECIMAL(5, 2) NULL,
    MODIFY `s3_attitude` DECIMAL(5, 2) NULL,
    MODIFY `s3_contextUnderstanding` DECIMAL(5, 2) NULL,
    MODIFY `s3_systematicThinking` DECIMAL(5, 2) NULL,
    MODIFY `s3_decisionMaking` DECIMAL(5, 2) NULL,
    MODIFY `s3_adaptability` DECIMAL(5, 2) NULL,
    MODIFY `s3_leadership` DECIMAL(5, 2) NULL,
    MODIFY `s3_verbalComm` DECIMAL(5, 2) NULL,
    MODIFY `s3_writtenComm` DECIMAL(5, 2) NULL,
    MODIFY `s3_selflessness` DECIMAL(5, 2) NULL,
    MODIFY `s3_ruleCompliance` DECIMAL(5, 2) NULL,
    MODIFY `s3_selfReliance` DECIMAL(5, 2) NULL,
    MODIFY `t_potential` TEXT NULL,
    MODIFY `t_strengthsWeaknesses` TEXT NULL,
    MODIFY `t_trainingNeeds` TEXT NULL,
    MODIFY `scorePerf` DECIMAL(5, 2) NULL,
    MODIFY `scoreResult` DECIMAL(5, 2) NULL,
    MODIFY `scoreComp` DECIMAL(5, 2) NULL,
    MODIFY `scoreTotal` DECIMAL(5, 2) NULL,
    MODIFY `managerComment` TEXT NULL,
    MODIFY `mdComment` TEXT NULL,
    MODIFY `hrNote` TEXT NULL,
    MODIFY `submitterComment` TEXT NULL;

-- AlterTable
ALTER TABLE `positionchangelog` MODIFY `fromLevel` ENUM('STAFF', 'SVR', 'ASST', 'MANAGER', 'MD') NULL,
    MODIFY `toLevel` ENUM('STAFF', 'SVR', 'ASST', 'MANAGER', 'MD') NULL,
    MODIFY `reason` TEXT NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `failedLoginAttempts`,
    DROP COLUMN `lockedUntil`,
    ADD COLUMN `username` VARCHAR(40) NOT NULL,
    MODIFY `email` VARCHAR(160) NULL;

-- AlterTable
ALTER TABLE `userdepartment` MODIFY `positionLevel` ENUM('STAFF', 'SVR', 'ASST', 'MANAGER', 'MD') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Organization_code_deletedAt_key` ON `Organization`(`code`, `deletedAt`);

-- CreateIndex
CREATE INDEX `PasswordReset_userId_usedAt_idx` ON `PasswordReset`(`userId`, `usedAt`);

-- CreateIndex
CREATE INDEX `PasswordReset_userId_expiresAt_idx` ON `PasswordReset`(`userId`, `expiresAt`);

-- CreateIndex
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);

-- CreateIndex
CREATE INDEX `User_email_idx` ON `User`(`email`);

-- CreateIndex
CREATE INDEX `User_roleId_deletedAt_idx` ON `User`(`roleId`, `deletedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `User_employeeCode_deletedAt_key` ON `User`(`employeeCode`, `deletedAt`);

-- CreateIndex
CREATE INDEX `UserDepartment_userId_isActive_idx` ON `UserDepartment`(`userId`, `isActive`);

-- CreateIndex
CREATE INDEX `UserDepartment_userId_startedAt_idx` ON `UserDepartment`(`userId`, `startedAt`);
