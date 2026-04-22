-- Create enums
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "SuggestionKind" AS ENUM ('category', 'tag');

-- Create table
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" VARCHAR(2000),
    "priority" "TaskPriority" NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "classificationKind" "SuggestionKind",
    "classificationValue" VARCHAR(64),
    "parentTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Add self relation
ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_parentTaskId_fkey"
FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Baseline indexes for filtering/search
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");
CREATE INDEX "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");
CREATE INDEX "tasks_status_priority_dueDate_idx" ON "tasks"("status", "priority", "dueDate");
