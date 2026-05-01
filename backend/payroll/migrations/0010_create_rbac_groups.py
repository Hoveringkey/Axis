from django.db import migrations


def create_rbac_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.get_or_create(name="HR_CAPTURE")
    Group.objects.get_or_create(name="FINANCE_ADMIN")


class Migration(migrations.Migration):

    dependencies = [
        ("payroll", "0009_loan_is_active_loan_status"),
    ]

    operations = [
        migrations.RunPython(create_rbac_groups, migrations.RunPython.noop),
    ]
