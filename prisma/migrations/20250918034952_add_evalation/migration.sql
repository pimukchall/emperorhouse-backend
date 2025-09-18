-- CreateTable
CREATE TABLE `Evaluation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `round` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `evaluatorId` INTEGER NOT NULL,
    `deptId` INTEGER NOT NULL,
    `scoresJson` JSON NOT NULL,
    `section1` DECIMAL(6, 2) NOT NULL,
    `section2` DECIMAL(6, 2) NOT NULL,
    `section3` DECIMAL(6, 2) NOT NULL,
    `totalScore` DECIMAL(6, 2) NOT NULL,
    `comment` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedByHeadId` INTEGER NULL,
    `approvedByHeadAt` DATETIME(3) NULL,
    `approvedByMDId` INTEGER NULL,
    `approvedByMDAt` DATETIME(3) NULL,
    `sentToHRById` INTEGER NULL,
    `sentToHRAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Evaluation_year_round_idx`(`year`, `round`),
    INDEX `Evaluation_deptId_year_round_idx`(`deptId`, `year`, `round`),
    INDEX `Evaluation_employeeId_year_round_idx`(`employeeId`, `year`, `round`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_evaluatorId_fkey` FOREIGN KEY (`evaluatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evaluation` ADD CONSTRAINT `Evaluation_deptId_fkey` FOREIGN KEY (`deptId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
