-- AlterTable: add config column to games (template-specific configuration)
ALTER TABLE "games" ADD COLUMN "config" JSONB;
