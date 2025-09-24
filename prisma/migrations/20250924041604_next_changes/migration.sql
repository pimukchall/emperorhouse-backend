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
    `deletedAt` DATETIME(3) NULL,
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

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_primaryUserDeptId_key`(`primaryUserDeptId`),
    UNIQUE INDEX `User_employeeCode_key`(`employeeCode`),
    INDEX `User_roleId_idx`(`roleId`),
    INDEX `User_orgId_idx`(`orgId`),
    INDEX `User_employeeType_idx`(`employeeType`),
    INDEX `User_contractType_idx`(`contractType`),
    INDEX `User_startDate_idx`(`startDate`),
    INDEX `User_resignedAt_idx`(`resignedAt`),
    INDEX `User_deletedAt_idx`(`deletedAt`),
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
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserDepartment_userId_departmentId_idx`(`userId`, `departmentId`),
    INDEX `UserDepartment_departmentId_positionLevel_idx`(`departmentId`, `positionLevel`),
    INDEX `UserDepartment_startedAt_idx`(`startedAt`),
    INDEX `UserDepartment_endedAt_idx`(`endedAt`),
    UNIQUE INDEX `UserDepartment_userId_departmentId_isActive_key`(`userId`, `departmentId`, `isActive`),
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

-- CreateTable
CREATE TABLE `EvalCycle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `stage` ENUM('MID_YEAR', 'YEAR_END') NOT NULL,
    `openAt` DATETIME(3) NOT NULL,
    `closeAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EvalCycle_code_key`(`code`),
    INDEX `EvalCycle_year_stage_idx`(`year`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evaluation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerId` INTEGER NOT NULL,
    `managerId` INTEGER NULL,
    `mdId` INTEGER NULL,
    `cycleId` INTEGER NOT NULL,
    `type` ENUM('OPERATIONAL', 'SUPERVISOR') NOT NULL,
    `stage` ENUM('MID_YEAR', 'YEAR_END') NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVER_APPROVED', 'MD_APPROVED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `approverAt` DATETIME(3) NULL,
    `mdAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `s1_responsibility` DOUBLE NULL,
    `s1_development` DOUBLE NULL,
    `s1_workload` DOUBLE NULL,
    `s1_qualityStandard` DOUBLE NULL,
    `s1_coordination` DOUBLE NULL,
    `s2_valueOfWork` DOUBLE NULL,
    `s2_customerSatisfaction` DOUBLE NULL,
    `s2_costEffectiveness` DOUBLE NULL,
    `s2_timeliness` DOUBLE NULL,
    `s3_jobKnowledge` DOUBLE NULL,
    `s3_attitude` DOUBLE NULL,
    `s3_contextUnderstanding` DOUBLE NULL,
    `s3_systematicThinking` DOUBLE NULL,
    `s3_decisionMaking` DOUBLE NULL,
    `s3_adaptability` DOUBLE NULL,
    `s3_leadership` DOUBLE NULL,
    `s3_verbalComm` DOUBLE NULL,
    `s3_writtenComm` DOUBLE NULL,
    `s3_selflessness` DOUBLE NULL,
    `s3_ruleCompliance` DOUBLE NULL,
    `s3_selfReliance` DOUBLE NULL,
    `t_potential` VARCHAR(191) NULL,
    `t_strengthsWeaknesses` VARCHAR(191) NULL,
    `t_trainingNeeds` VARCHAR(191) NULL,
    `scorePerf` DOUBLE NULL,
    `scoreResult` DOUBLE NULL,
    `scoreComp` DOUBLE NULL,
    `scoreTotal` DOUBLE NULL,
    `ownerComment` VARCHAR(191) NULL,
    `ownerSignedAt` DATETIME(3) NULL,
    `managerComment` VARCHAR(191) NULL,
    `managerSignedAt` DATETIME(3) NULL,
    `mdComment` VARCHAR(191) NULL,
    `mdSignedAt` DATETIME(3) NULL,
    `hrNote` VARCHAR(191) NULL,
    `hrReceivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Evaluation_stage_idx`(`stage`),
    INDEX `Evaluation_status_idx`(`status`),
    INDEX `Evaluation_managerId_idx`(`managerId`),
    INDEX `Evaluation_mdId_idx`(`mdId`),
    INDEX `Evaluation_cycleId_status_idx`(`cycleId`, `status`),
    UNIQUE INDEX `Evaluation_cycleId_ownerId_key`(`cycleId`, `ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_primaryUserDeptId_fkey` FOREIGN KEY (`primaryUserDeptId`) REFERENCES `UserDepartment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDepartment` ADD CONSTRAINT `UserDepartment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDepartment` ADD CONSTRAINT `UserDepartment_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `PositionChangeLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `PositionChangeLog_fromDepartmentId_fkey` FOREIGN KEY (`fromDepartmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `PositionChangeLog_toDepartmentId_fkey` FOREIGN KEY (`toDepartmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionChangeLog` ADD CONSTRAINT `PositionChangeLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordReset` ADD CONSTRAINT `PasswordReset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_mdId_fkey` FOREIGN KEY (`mdId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `EvalCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
