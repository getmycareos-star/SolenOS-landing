-- Allow one care-recipient profile per caregiver/case pair.
-- A NULL case_id denotes the caregiver's default/no-case profile.
-- Drop only standalone/constraint-backed unique keys on caregiver_id alone;
-- otherwise they would force different cases to overwrite each other.
DO $$
DECLARE
  idx record;
BEGIN
  IF to_regclass('public.care_recipient_profiles') IS NULL THEN
    RAISE EXCEPTION 'care_recipient_profiles must exist before migration 049 can run';
  END IF;

  FOR idx IN
    SELECT
      ns.nspname AS schema_name,
      index_class.relname AS index_name,
      constraint_row.conname AS constraint_name
    FROM pg_index index_row
    JOIN pg_class table_class ON table_class.oid = index_row.indrelid
    JOIN pg_namespace ns ON ns.oid = table_class.relnamespace
    JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
    LEFT JOIN pg_constraint constraint_row ON constraint_row.conindid = index_row.indexrelid
    WHERE ns.nspname = 'public'
      AND table_class.relname = 'care_recipient_profiles'
      AND index_row.indisunique
      AND NOT index_row.indisprimary
      AND index_row.indpred IS NULL
      AND (
        SELECT array_agg(attribute.attname::text ORDER BY key_column.ordinality)
        FROM unnest(index_row.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
        JOIN pg_attribute attribute
          ON attribute.attrelid = table_class.oid
         AND attribute.attnum = key_column.attnum
        WHERE key_column.ordinality <= index_row.indnkeyatts
      ) = ARRAY['caregiver_id']::text[]
  LOOP
    IF idx.constraint_name IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.care_recipient_profiles DROP CONSTRAINT %I',
        idx.schema_name,
        idx.constraint_name
      );
    ELSE
      EXECUTE format('DROP INDEX %I.%I', idx.schema_name, idx.index_name);
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_care_recipient_profiles_caregiver_case
  ON public.care_recipient_profiles (caregiver_id, case_id)
  WHERE case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_care_recipient_profiles_caregiver_without_case
  ON public.care_recipient_profiles (caregiver_id)
  WHERE case_id IS NULL;
