/*
  Warnings:

  - You are about to drop the column `capacityUtilization` on the `AnalyticsSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `EventCenter` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `EventGroup` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `notificationType` on the `Notification` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[registrationId,groupId]` on the table `GroupAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deliveryMethod` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `triggerType` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "GroupAssignment_registrationId_key";

-- AlterTable
ALTER TABLE "AnalyticsSnapshot" DROP COLUMN "capacityUtilization";

-- AlterTable
ALTER TABLE "AuthUser" ALTER COLUMN "phoneNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "capacity",
ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "isPublished" SET DEFAULT true;

-- AlterTable
ALTER TABLE "EventCenter" DROP COLUMN "capacity";

-- AlterTable
ALTER TABLE "EventGroup" DROP COLUMN "capacity";

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "ageBracket" TEXT,
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "consentTimestamp" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "course" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "graduationYear" INTEGER,
ADD COLUMN     "guardianEmail" TEXT,
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "guardianRelationship" TEXT,
ADD COLUMN     "institutionName" TEXT,
ADD COLUMN     "institutionType" TEXT,
ADD COLUMN     "isMinor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "membershipCategory" TEXT,
ADD COLUMN     "otherNames" TEXT,
ADD COLUMN     "placeOfWork" TEXT,
ADD COLUMN     "preferredContactMethod" TEXT,
ADD COLUMN     "preferredName" TEXT,
ADD COLUMN     "privacyPolicyAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signupSource" TEXT NOT NULL DEFAULT 'WEB',
ADD COLUMN     "street" TEXT,
ADD COLUMN     "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappNumber" TEXT,
ADD COLUMN     "yearJoined" INTEGER;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "channel",
DROP COLUMN "notificationType",
ADD COLUMN     "deliveryMethod" TEXT NOT NULL,
ADD COLUMN     "recipientId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "templateData" JSONB,
ADD COLUMN     "triggerType" TEXT NOT NULL,
ALTER COLUMN "eventId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OTPToken" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "attendanceIntent" TEXT DEFAULT 'CONFIRMED';

-- AlterTable
ALTER TABLE "RoleAssignment" ADD COLUMN     "managedBy" TEXT;

-- CreateTable
CREATE TABLE "NotificationTrigger" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "templateId" TEXT,
    "recipientType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationTrigger_eventId_idx" ON "NotificationTrigger"("eventId");

-- CreateIndex
CREATE INDEX "NotificationTrigger_triggerType_idx" ON "NotificationTrigger"("triggerType");

-- CreateIndex
CREATE INDEX "EventCenter_areaId_idx" ON "EventCenter"("areaId");

-- CreateIndex
CREATE INDEX "EventCenter_zoneId_idx" ON "EventCenter"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupAssignment_registrationId_groupId_key" ON "GroupAssignment"("registrationId", "groupId");

-- CreateIndex
CREATE INDEX "Member_branchId_idx" ON "Member"("branchId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");

-- CreateIndex
CREATE INDEX "OTPToken_phoneNumber_idx" ON "OTPToken"("phoneNumber");

-- CreateIndex
CREATE INDEX "OTPToken_email_idx" ON "OTPToken"("email");

-- CreateIndex
CREATE INDEX "RoleAssignment_managedBy_idx" ON "RoleAssignment"("managedBy");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_managedBy_fkey" FOREIGN KEY ("managedBy") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCenter" ADD CONSTRAINT "EventCenter_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCenter" ADD CONSTRAINT "EventCenter_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTrigger" ADD CONSTRAINT "NotificationTrigger_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
