-- Remove legacy status checks with nonstandard names before restoring the supported enum.
DO $$
DECLARE
  status_constraint RECORD;
BEGIN
  FOR status_constraint IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'feedback'::REGCLASS
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE FORMAT(
      'ALTER TABLE feedback DROP CONSTRAINT %I',
      status_constraint.conname
    );
  END LOOP;
END
$$;

UPDATE feedback
   SET status = 'open'
 WHERE status NOT IN ('open', 'seen', 'resolved');

ALTER TABLE feedback
  ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('open', 'seen', 'resolved'));
