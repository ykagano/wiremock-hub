-- Migration: Remove baseUrl column from Project table
-- SQLite 3.35.0+ supports DROP COLUMN directly
ALTER TABLE "Project" DROP COLUMN "baseUrl";
