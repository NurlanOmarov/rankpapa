-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'START', 'PRO', 'AGENCY');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GeoCity" AS ENUM ('ALMATY', 'ASTANA', 'SHYMKENT', 'ALL');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'MIXED');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('PF_BOOST', 'POSITION_TRACKING');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('SUCCESS', 'FAILED', 'CAPTCHA', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "ProxyStatus" AS ENUM ('ACTIVE', 'BANNED', 'SLOW');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'CHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SANCTION', 'INFO', 'BILLING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trialEndsAt" TIMESTAMP(3),
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "geo" "GeoCity" NOT NULL DEFAULT 'ALMATY',
    "deviceType" "DeviceType" NOT NULL DEFAULT 'MIXED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "dailyVisitLimit" INTEGER NOT NULL DEFAULT 100,
    "dwellTimeMin" INTEGER NOT NULL DEFAULT 60,
    "dwellTimeMax" INTEGER NOT NULL DEFAULT 180,
    "pagesPerSession" INTEGER NOT NULL DEFAULT 2,
    "rampUpDays" INTEGER NOT NULL DEFAULT 7,
    "scheduleStart" INTEGER NOT NULL DEFAULT 9,
    "scheduleEnd" INTEGER NOT NULL DEFAULT 22,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "proxy" TEXT NOT NULL,
    "clickPosition" INTEGER,
    "dwellSeconds" INTEGER,
    "pagesVisited" INTEGER NOT NULL DEFAULT 1,
    "status" "VisitStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "trafficBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "position" INTEGER,
    "url" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proxy" (
    "id" TEXT NOT NULL,
    "connection" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'prosox',
    "country" TEXT NOT NULL DEFAULT 'KZ',
    "city" TEXT,
    "status" "ProxyStatus" NOT NULL DEFAULT 'ACTIVE',
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proxy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "TransactionType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Site_userId_domain_key" ON "Site"("userId", "domain");

-- CreateIndex
CREATE INDEX "Position_keywordId_checkedAt_idx" ON "Position"("keywordId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_connection_key" ON "Proxy"("connection");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
