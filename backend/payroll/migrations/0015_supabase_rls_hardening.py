from django.db import migrations


SENSITIVE_TABLES = (
    'payroll_employee',
    'payroll_incidencerecord',
    'payroll_loan',
    'payroll_extrahourbank',
    'payroll_payrollsnapshot',
    'payroll_payrollclosure',
    'payroll_incidencecatalog',
    'payroll_schedule',
)

def quoted_csv(names):
    return ',\n    '.join(f'public.{name}' for name in names)


def quoted_sql_array(names):
    return ',\n      '.join(f"'{name}'" for name in names)


class Migration(migrations.Migration):

    dependencies = [
        ('payroll', '0014_payrollsnapshot_immutability_trigger'),
    ]

    operations = [
        migrations.RunSQL(
            sql=f"""
-- Supabase hardening: Django/DRF remains the only public API for payroll data.
-- RLS is enabled without applying it to table owners for now. Local Django
-- currently connects as the postgres owner via DATABASE_URL, and owner-level RLS
-- without backend policies would block normal ORM reads/writes during
-- migrations, tests, and application use.

ALTER TABLE public.payroll_employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_incidencerecord ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_loan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_extrahourbank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payrollsnapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payrollclosure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_incidencecatalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_schedule ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name text;
  sequence_record record;
BEGIN
  FOR role_name IN
    SELECT rolname
    FROM pg_roles
    WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE
    {quoted_csv(SENSITIVE_TABLES)}
    FROM %I',
      role_name
    );

    FOR sequence_record IN
      SELECT DISTINCT seq_ns.nspname AS sequence_schema, seq.relname AS sequence_name
      FROM pg_class seq
      JOIN pg_namespace seq_ns ON seq_ns.oid = seq.relnamespace
      JOIN pg_depend dep ON dep.objid = seq.oid
      JOIN pg_class tbl ON tbl.oid = dep.refobjid
      JOIN pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace
      JOIN pg_attribute attr
        ON attr.attrelid = tbl.oid
       AND attr.attnum = dep.refobjsubid
      WHERE seq.relkind = 'S'
        AND dep.deptype IN ('a', 'i')
        AND tbl_ns.nspname = 'public'
        AND tbl.relname = ANY (ARRAY[
      {quoted_sql_array(SENSITIVE_TABLES)}
        ])
    LOOP
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I',
        sequence_record.sequence_schema,
        sequence_record.sequence_name,
        role_name
      );
    END LOOP;
  END LOOP;
END
$$;
""",
            reverse_sql="""
-- Reverse disables RLS for local rollback only. It intentionally does not
-- restore anon/authenticated grants because previous grants are environment
-- specific and restoring broad direct access to payroll tables would be unsafe.
ALTER TABLE public.payroll_employee DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_incidencerecord DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_loan DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_extrahourbank DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payrollsnapshot DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payrollclosure DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_incidencecatalog DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_schedule DISABLE ROW LEVEL SECURITY;
""",
        ),
    ]
