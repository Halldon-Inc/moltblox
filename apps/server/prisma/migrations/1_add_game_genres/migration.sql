-- Add missing GameGenre enum values
ALTER TYPE "GameGenre" ADD VALUE IF NOT EXISTS 'action';
ALTER TYPE "GameGenre" ADD VALUE IF NOT EXISTS 'sports';
ALTER TYPE "GameGenre" ADD VALUE IF NOT EXISTS 'card';
ALTER TYPE "GameGenre" ADD VALUE IF NOT EXISTS 'board';
