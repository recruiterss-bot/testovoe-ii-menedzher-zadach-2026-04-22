DROP TABLE IF EXISTS "tasks";

DROP TYPE IF EXISTS "SuggestionKind";
DROP TYPE IF EXISTS "TaskPriority";
DROP TYPE IF EXISTS "TaskStatus";

DO $$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    DELETE FROM "_prisma_migrations"
    WHERE migration_name = '20260422130000_init_tasks';
  END IF;
END $$;
