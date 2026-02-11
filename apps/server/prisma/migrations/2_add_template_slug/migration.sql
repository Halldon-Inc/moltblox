-- AlterTable: add templateSlug column to games
ALTER TABLE "games" ADD COLUMN "templateSlug" TEXT;

-- CreateIndex
CREATE INDEX "games_templateSlug_idx" ON "games"("templateSlug");
