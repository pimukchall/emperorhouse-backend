-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `labelTh` VARCHAR(191) NOT NULL,
    `labelEn` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nameTh` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Department_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `firstNameTh` VARCHAR(191) NOT NULL,
    `lastNameTh` VARCHAR(191) NOT NULL,
    `firstNameEn` VARCHAR(191) NOT NULL,
    `lastNameEn` VARCHAR(191) NOT NULL,
    `roleId` INTEGER NOT NULL,
    `orgId` INTEGER NULL,
    `primaryUserDeptId` INTEGER NULL,
    `employeeCode` VARCHAR(191) NULL,
    `employeeType` ENUM('DAILY', 'MONTHLY') NULL,
    `contractType` ENUM('PERMANENT', 'TEMPORARY', 'PROBATION') NULL,
    `startDate` DATETIME(3) NULL,
    `probationEndDate` DATETIME(3) NULL,
    `resignedAt` DATETIME(3) NULL,
    `birthDate` DATETIME(3) NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED') NULL,
    `signature` LONGBLOB NULL,
    `avatarPath` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_primaryUserDeptId_key`(`primaryUserDeptId`),
    UNIQUE INDEX `User_employeeCode_key`(`employeeCode`),
    INDEX `User_roleId_idx`(`roleId`),
    INDEX `User_orgId_idx`(`orgId`),
    INDEX `User_employeeType_idx`(`employeeType`),
    INDEX `User_contractType_idx`(`contractType`),
    INDEX `User_startDate_idx`(`startDate`),
    INDEX `User_resignedAt_idx`(`resignedAt`),
    INDEX `User_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `User_email_deletedAt_key`(`email`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserDepartment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `departmentId` INTEGER NOT NULL,
    `positionLevel` ENUM('STAF', 'SVR', 'ASST', 'MANAGER', 'MD') NOT NULL,
    `positionName` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserDepartment_userId_departmentId_idx`(`userId`, `departmentId`),
    INDEX `UserDepartment_departmentId_positionLevel_idx`(`departmentId`, `positionLevel`),
    INDEX `UserDepartment_startedAt_idx`(`startedAt`),
    INDEX `UserDepartment_endedAt_idx`(`endedAt`),
    UNIQUE INDEX `UserDepartment_userId_departmentId_endedAt_key`(`userId`, `departmentId`, `endedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PositionChangeLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('PROMOTE', 'DEMOTE', 'TRANSFER') NOT NULL,
    `userId` INTEGER NOT NULL,
    `fromDepartmentId` INTEGER NULL,
    `toDepartmentId` INTEGER NULL,
    `actorId` INTEGER NULL,
    `fromLevel` ENUM('STAF', 'SVR', 'ASST', 'MANAGER', 'MD') NULL,
    `toLevel` ENUM('STAF', 'SVR', 'ASST', 'MANAGER', 'MD') NULL,
    `fromName` VARCHAR(191) NULL,
    `toName` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PositionChangeLog_userId_effectiveDate_idx`(`userId`, `effectiveDate`),
    INDEX `PositionChangeLog_kind_idx`(`kind`),
    INDEX `PositionChangeLog_fromDepartmentId_idx`(`fromDepartmentId`),
    INDEX `PositionChangeLog_toDepartmentId_idx`(`toDepartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordReset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordReset_token_key`(`token`),
    INDEX `PasswordReset_userId_idx`(`userId`),
    INDEX `PasswordReset_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `subject` VARCHAR(160) NOT NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContactMessage_createdAt_idx`(`createdAt`),
    INDEX `ContactMessage_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `FK_User_roleId` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `FK_User_orgId` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `FK_User_primaryUserDeptId` FOREIGN KEY (`primaryUserDeptId`) REFERENCES `UserDepartment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDepartment` ADD CONSTRAINT `FK_UserDepartment_userId` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDepartment` ADD CONSTRAINT `FK_UserDepartment_departmentId` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `FK_PCL_userId` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `FK_PCL_fromDepartmentId` FOREIGN KEY (`fromDepartmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `FK_PCL_toDepartmentId` FOREIGN KEY (`toDepartmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `FK_PCL_actorId` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordReset` ADD CONSTRAINT `FK_PasswordReset_userId` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
