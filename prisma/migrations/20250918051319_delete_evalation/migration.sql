/*
  Warnings:

  - You are about to drop the `evaluation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `evaluation` DROP FOREIGN KEY `Evaluation_deptId_fkey`;

-- DropForeignKey
ALTER TABLE `evaluation` DROP FOREIGN KEY `Evaluation_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `evaluation` DROP FOREIGN KEY `Evaluation_evaluatorId_fkey`;

-- DropTable
DROP TABLE `evaluation`;
