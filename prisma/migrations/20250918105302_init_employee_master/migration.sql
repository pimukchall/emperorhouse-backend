/*
  Warnings:

  - A unique constraint covering the columns `[employeeCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,deletedAt]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `User_email_key` ON `user`;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `birthDate` DATETIME(3) NULL,
    ADD COLUMN `contractType` ENUM('PERMANENT', 'TEMPORARY', 'PROBATION') NULL,
    ADD COLUMN `employeeCode` VARCHAR(191) NULL,
    ADD COLUMN `employeeType` ENUM('DAILY', 'MONTHLY') NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED') NULL,
    ADD COLUMN `orgId` INTEGER NULL,
    ADD COLUMN `positionLevel` ENUM('STAF', 'SVR', 'ASST', 'MGR', 'MD', 'CEO', 'ADMIN', 'DEV') NULL,
    ADD COLUMN `positionName` VARCHAR(191) NULL,
    ADD COLUMN `probationEndDate` DATETIME(3) NULL,
    ADD COLUMN `resignedAt` DATETIME(3) NULL,
    ADD COLUMN `signature` LONGBLOB NULL,
    ADD COLUMN `startDate` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Organization` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nameTh` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organization_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_employeeCode_key` ON `User`(`employeeCode`);

-- CreateIndex
CREATE INDEX `User_roleId_departmentId_idx` ON `User`(`roleId`, `departmentId`);

-- CreateIndex
CREATE INDEX `User_orgId_idx` ON `User`(`orgId`);

-- CreateIndex
CREATE INDEX `User_employeeType_idx` ON `User`(`employeeType`);

-- CreateIndex
CREATE INDEX `User_contractType_idx` ON `User`(`contractType`);

-- CreateIndex
CREATE INDEX `User_positionLevel_idx` ON `User`(`positionLevel`);

-- CreateIndex
CREATE INDEX `User_startDate_idx` ON `User`(`startDate`);

-- CreateIndex
CREATE INDEX `User_resignedAt_idx` ON `User`(`resignedAt`);

-- CreateIndex
CREATE INDEX `User_deletedAt_idx` ON `User`(`deletedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `User_email_deletedAt_key` ON `User`(`email`, `deletedAt`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
