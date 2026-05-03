from io import StringIO

from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from payroll.models import Employee, ExtraHourBank, IncidenceRecord, Loan
from payroll.permissions import FINANCE_ADMIN, HR_CAPTURE


class SeedDevCommandTests(TestCase):
    def call_seed(self, **options):
        output = StringIO()
        call_command("seed_dev", stdout=output, **options)
        return output.getvalue()

    @override_settings(DEBUG=True)
    def test_seed_dev_runs_with_debug_true(self):
        output = self.call_seed()

        self.assertIn("seed_dev completed.", output)
        self.assertEqual(Employee.objects.filter(no_nomina__startswith="DEMO-").count(), 8)
        self.assertTrue(Group.objects.filter(name=HR_CAPTURE).exists())
        self.assertTrue(Group.objects.filter(name=FINANCE_ADMIN).exists())

        hr_user = User.objects.get(username="hr_demo")
        finance_user = User.objects.get(username="finance_demo")
        admin_user = User.objects.get(username="admin_demo")

        self.assertEqual(list(hr_user.groups.values_list("name", flat=True)), [HR_CAPTURE])
        self.assertFalse(hr_user.is_staff)
        self.assertFalse(hr_user.is_superuser)
        self.assertEqual(list(finance_user.groups.values_list("name", flat=True)), [FINANCE_ADMIN])
        self.assertFalse(finance_user.is_staff)
        self.assertFalse(finance_user.is_superuser)
        self.assertTrue(admin_user.is_staff)
        self.assertTrue(admin_user.is_superuser)

    @override_settings(DEBUG=True)
    def test_seed_dev_is_idempotent(self):
        self.call_seed()
        first_counts = {
            "groups": Group.objects.filter(name__in=[HR_CAPTURE, FINANCE_ADMIN]).count(),
            "users": User.objects.filter(username__in=["hr_demo", "finance_demo", "admin_demo"]).count(),
            "employees": Employee.objects.filter(no_nomina__startswith="DEMO-").count(),
            "incidences": IncidenceRecord.objects.filter(
                empleado__no_nomina__startswith="DEMO-"
            ).count(),
            "active_loans": Loan.objects.filter(
                empleado__no_nomina__startswith="DEMO-",
                is_active=True,
            ).count(),
            "banks": ExtraHourBank.objects.filter(
                empleado__no_nomina__startswith="DEMO-"
            ).count(),
        }

        self.call_seed()
        second_counts = {
            "groups": Group.objects.filter(name__in=[HR_CAPTURE, FINANCE_ADMIN]).count(),
            "users": User.objects.filter(username__in=["hr_demo", "finance_demo", "admin_demo"]).count(),
            "employees": Employee.objects.filter(no_nomina__startswith="DEMO-").count(),
            "incidences": IncidenceRecord.objects.filter(
                empleado__no_nomina__startswith="DEMO-"
            ).count(),
            "active_loans": Loan.objects.filter(
                empleado__no_nomina__startswith="DEMO-",
                is_active=True,
            ).count(),
            "banks": ExtraHourBank.objects.filter(
                empleado__no_nomina__startswith="DEMO-"
            ).count(),
        }

        self.assertEqual(first_counts, second_counts)
        self.assertEqual(second_counts["groups"], 2)
        self.assertEqual(second_counts["users"], 3)
        self.assertEqual(second_counts["employees"], 8)
        self.assertEqual(second_counts["incidences"], 7)
        self.assertEqual(second_counts["active_loans"], 2)
        self.assertEqual(second_counts["banks"], 1)

        duplicate_banks = ExtraHourBank.objects.filter(
            empleado__no_nomina__startswith="DEMO-"
        ).values_list("empleado_id", flat=True)
        self.assertEqual(len(duplicate_banks), len(set(duplicate_banks)))

    @override_settings(DEBUG=False)
    def test_seed_dev_blocks_when_debug_false(self):
        with self.assertRaises(CommandError):
            self.call_seed()

        self.assertEqual(Employee.objects.filter(no_nomina__startswith="DEMO-").count(), 0)

    @override_settings(DEBUG=False)
    def test_seed_dev_allow_production_runs_with_warning(self):
        output = self.call_seed(allow_production=True)

        self.assertIn("WARNING: --allow-production was used.", output)
        self.assertIn("seed_dev completed.", output)
        self.assertEqual(Employee.objects.filter(no_nomina__startswith="DEMO-").count(), 8)
