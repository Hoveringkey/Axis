from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('payroll', '0013_payrollsnapshot_unique_payroll_snapshot_closure_employee'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
CREATE OR REPLACE FUNCTION public.deny_payrollsnapshot_update_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PayrollSnapshot is immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payrollsnapshot_no_update_delete
ON public.payroll_payrollsnapshot;

CREATE TRIGGER payrollsnapshot_no_update_delete
BEFORE UPDATE OR DELETE ON public.payroll_payrollsnapshot
FOR EACH ROW
EXECUTE FUNCTION public.deny_payrollsnapshot_update_delete();
""",
            reverse_sql="""
DROP TRIGGER IF EXISTS payrollsnapshot_no_update_delete
ON public.payroll_payrollsnapshot;

DROP FUNCTION IF EXISTS public.deny_payrollsnapshot_update_delete();
""",
        ),
    ]
