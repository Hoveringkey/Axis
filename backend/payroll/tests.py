import datetime
from decimal import Decimal
from unittest import skipUnless
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.test import SimpleTestCase, TestCase, TransactionTestCase
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import Group, User
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Employee, ExtraHourBank, IncidenceCatalog, IncidenceRecord, Loan, PayrollClosure, PayrollSnapshot, Schedule
from .permissions import FINANCE_ADMIN, HR_CAPTURE
from .services import calculate_payroll_for_week, safe_replace_year

class SafeReplaceYearTests(SimpleTestCase):
    def test_leap_year_to_non_leap_year(self):
        # Feb 29, 2024 (leap) to 2023 (non-leap)
        leap_date = datetime.date(2024, 2, 29)
        result = safe_replace_year(leap_date, 2023)
        self.assertEqual(result, datetime.date(2023, 2, 28))

    def test_leap_year_to_leap_year(self):
        # Feb 29, 2024 (leap) to 2028 (leap)
        leap_date = datetime.date(2024, 2, 29)
        result = safe_replace_year(leap_date, 2028)
        self.assertEqual(result, datetime.date(2028, 2, 29))

    def test_normal_date_replacement(self):
        # Jan 1, 2024 to 2023
        normal_date = datetime.date(2024, 1, 1)
        result = safe_replace_year(normal_date, 2023)
        self.assertEqual(result, datetime.date(2023, 1, 1))

    def test_non_leap_feb_28_to_leap_year(self):
        # Feb 28, 2023 (non-leap) to 2024 (leap)
        date_obj = datetime.date(2023, 2, 28)
        result = safe_replace_year(date_obj, 2024)
        self.assertEqual(result, datetime.date(2024, 2, 28))

class EmployeeBulkCreateTests(APITestCase):
    def setUp(self):
        # Create user and authenticate with JWT token
        self.user = User.objects.create_user(username='testadmin', password='testpassword')
        self.user.groups.add(Group.objects.get_or_create(name=HR_CAPTURE)[0])
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        self.url = '/api/payroll/employees/bulk-create/'
        self.weekday_schedule = Schedule.objects.create(time_range="08:00-18:00")
        self.saturday_schedule = Schedule.objects.create(time_range="08:00-13:00")

        # Valid payloads for testing
        self.valid_employee_1 = {
            "no_nomina": "EMP-001",
            "nombre": "Juan Perez",
            "puesto": "Operador",
            "horario_lv": "08:00-18:00",
            "horario_s": "08:00-13:00"
        }
        self.valid_employee_2 = {
            "no_nomina": "EMP-002",
            "nombre": "Maria Gonzalez",
            "puesto": "Supervisor",
            "horario_lv": "08:00-18:00",
            "horario_s": None # null test
        }
        self.valid_employee_3 = {
            "no_nomina": "EMP-003",
            "nombre": "Carlos Sanchez",
            "puesto": "Mantenimiento",
            "horario_lv": "08:00-18:00",
            "horario_s": "08:00-13:00"
        }
        self.valid_employee_4 = {
            "no_nomina": "EMP-004",
            "nombre": "Ana Gomez",
            "puesto": "Almacen",
            "horario_lv": "08:00-18:00"
            # omitted field test
        }

    def test_setup_works(self):
        self.assertEqual(self.url, '/api/payroll/employees/bulk-create/')

    def test_bulk_create_happy_path(self):
        """Test successful bulk creation of employees with different horario_s variations."""
        payload = [
            self.valid_employee_1,
            self.valid_employee_2,
            self.valid_employee_3,
            self.valid_employee_4
        ]

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 4)
        self.assertEqual(Employee.objects.count(), 4)

        # Verify database state
        emp1 = Employee.objects.get(no_nomina="EMP-001")
        self.assertEqual(emp1.horario_s, self.saturday_schedule)

        emp2 = Employee.objects.get(no_nomina="EMP-002")
        self.assertIsNone(emp2.horario_s)

        emp3 = Employee.objects.get(no_nomina="EMP-003")
        self.assertEqual(emp3.horario_s, self.saturday_schedule)

        emp4 = Employee.objects.get(no_nomina="EMP-004")
        self.assertIsNone(emp4.horario_s)

    def test_bulk_create_missing_mandatory_fields(self):
        """Test bulk creation fails when mandatory fields are missing."""
        invalid_employee = {
            "nombre": "Incompleto Perez",
            "horario_s": "08:00-13:00"
            # Missing no_nomina, puesto, horario_lv
        }
        payload = [self.valid_employee_1, invalid_employee]

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify atomicity: 0 insertions
        self.assertEqual(Employee.objects.count(), 0)

    def test_bulk_create_invalid_data_types(self):
        """Test bulk creation fails with invalid data types."""
        invalid_employee = {
            "no_nomina": "EMP-005",
            "nombre": "Tipo Invalido",
            "puesto": "Limpieza",
            "horario_lv": {"invalid": "dict"}, # Should be a string
        }
        payload = [invalid_employee]

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Employee.objects.count(), 0)

    def test_bulk_create_duplicate_no_nomina(self):
        """Test bulk creation rolls back when the payload contains a duplicate no_nomina."""
        duplicate_employee = self.valid_employee_2.copy()
        duplicate_employee["no_nomina"] = self.valid_employee_1["no_nomina"]
        duplicate_employee["nombre"] = "Empleado Duplicado"

        # The duplicate exists only within the request payload, so validation can pass
        # and the transaction is exercised during save.
        payload = [self.valid_employee_1, duplicate_employee]
        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify atomicity: no employees from the batch should be persisted
        self.assertEqual(Employee.objects.count(), 0)

    def test_bulk_create_mixed_batch(self):
        """Test bulk creation fails for the entire batch if even one item is invalid."""
        invalid_employee = {
            "no_nomina": "EMP-009",
            # Missing mandatory fields
        }
        payload = [self.valid_employee_1, self.valid_employee_2, invalid_employee]

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify atomicity: no valid items from the batch should be inserted
        self.assertEqual(Employee.objects.count(), 0)


class PayrollPermissionTests(APITestCase):
    employees_url = '/api/payroll/employees/'
    close_url = '/api/payroll/close/'

    def setUp(self):
        self.hr_group = Group.objects.get_or_create(name=HR_CAPTURE)[0]
        self.finance_group = Group.objects.get_or_create(name=FINANCE_ADMIN)[0]

    def test_authenticated_user_without_operational_group_gets_403(self):
        user = User.objects.create_user(username='no_group', password='testpassword')
        self.client.force_authenticate(user=user)

        response = self.client.get(self.employees_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_hr_capture_can_access_operational_endpoint(self):
        user = User.objects.create_user(username='hr_capture', password='testpassword')
        user.groups.add(self.hr_group)
        self.client.force_authenticate(user=user)

        response = self.client.get(self.employees_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_finance_admin_can_access_operational_endpoint(self):
        user = User.objects.create_user(username='finance_admin', password='testpassword')
        user.groups.add(self.finance_group)
        self.client.force_authenticate(user=user)

        response = self.client.get(self.employees_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_hr_capture_cannot_close_payroll(self):
        user = User.objects.create_user(username='hr_close', password='testpassword')
        user.groups.add(self.hr_group)
        self.client.force_authenticate(user=user)

        response = self.client.post(self.close_url, {'semana_num': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_finance_admin_close_payroll_does_not_fail_by_permission(self):
        user = User.objects.create_user(username='finance_close', password='testpassword')
        user.groups.add(self.finance_group)
        self.client.force_authenticate(user=user)

        response = self.client.post(self.close_url, {'semana_num': 1}, format='json')

        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class PayrollPreviewCommitTests(APITestCase):
    preview_url = '/api/payroll/preview/'
    commit_url = '/api/payroll/commit/'
    close_url = '/api/payroll/close/'
    snapshots_url = '/api/payroll/snapshots/'

    def setUp(self):
        self.hr_group = Group.objects.get_or_create(name=HR_CAPTURE)[0]
        self.finance_group = Group.objects.get_or_create(name=FINANCE_ADMIN)[0]
        self.schedule = Schedule.objects.create(time_range="08:00-18:00")
        self.employee = Employee.objects.create(
            no_nomina="EMP-PAY-001",
            nombre="Preview User",
            puesto="Operador",
            fecha_ingreso=datetime.date(2024, 1, 1),
            horario_lv=self.schedule,
        )
        self.loan = Loan.objects.create(
            empleado=self.employee,
            monto_total=Decimal('100.00'),
            abono_semanal=Decimal('25.00'),
            pagos_realizados=0,
        )
        self.bank = ExtraHourBank.objects.create(
            empleado=self.employee,
            horas_deuda=Decimal('10.00'),
        )

    def authenticate_with_group(self, group):
        user = User.objects.create_user(username=f'user_{group.name}', password='testpassword')
        user.groups.add(group)
        self.client.force_authenticate(user=user)
        return user

    def test_hr_capture_can_preview(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url, {'semana_num': 10, 'year': 2026})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_hr_capture_cannot_commit(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.post(self.commit_url, {'semana_num': 10}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_finance_admin_can_preview(self):
        self.authenticate_with_group(self.finance_group)

        response = self.client.get(self.preview_url, {'semana_num': 10, 'year': 2026})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_finance_admin_commit_does_not_fail_by_permission(self):
        self.authenticate_with_group(self.finance_group)

        response = self.client.post(self.commit_url, {'semana_num': 10}, format='json')

        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_preview_does_not_create_payroll_snapshot(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url, {'semana_num': 10, 'year': 2026})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PayrollClosure.objects.count(), 0)
        self.assertEqual(PayrollSnapshot.objects.count(), 0)

    def test_preview_does_not_modify_loans(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url, {'semana_num': 10, 'year': 2026})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.loan.refresh_from_db()
        self.assertEqual(self.loan.pagos_realizados, 0)
        self.assertTrue(self.loan.is_active)
        self.assertEqual(self.loan.status, 'PENDIENTE')

    def test_preview_does_not_modify_extra_hour_bank(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url, {'semana_num': 10, 'year': 2026})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.bank.refresh_from_db()
        self.assertEqual(self.bank.horas_deuda, Decimal('10.00'))

    def test_preview_missing_semana_num_returns_400(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_preview_invalid_semana_num_returns_400(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url, {'semana_num': 54})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_preview_year_zero_returns_400(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url, {'semana_num': 10, 'year': 0})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_preview_year_above_datetime_range_returns_400(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url, {'semana_num': 10, 'year': 10000})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_preview_non_integer_year_returns_400(self):
        self.authenticate_with_group(self.hr_group)

        response = self.client.get(self.preview_url, {'semana_num': 10, 'year': 'abc'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_commit_accepts_year_and_creates_closure_snapshot_summary_and_checksum(self):
        user = self.authenticate_with_group(self.finance_group)

        response = self.client.post(self.commit_url, {'semana_num': 10, 'year': 2026}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        closure = PayrollClosure.objects.get(iso_year=2026, semana_num=10)
        snapshot = PayrollSnapshot.objects.get(closure=closure)
        self.assertEqual(closure.closed_by, user)
        self.assertEqual(snapshot.iso_year, 2026)
        self.assertEqual(snapshot.semana_num, 10)
        self.assertEqual(snapshot.closure, closure)
        self.assertEqual(closure.total_employees, 1)
        self.assertEqual(closure.total_amount, snapshot.total_pagar)
        self.assertTrue(closure.checksum)

    def test_second_commit_returns_409_and_does_not_duplicate_or_mutate_again(self):
        self.authenticate_with_group(self.finance_group)

        first_response = self.client.post(self.commit_url, {'semana_num': 10, 'year': 2026}, format='json')
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.loan.refresh_from_db()
        self.bank.refresh_from_db()
        loan_payments_after_first = self.loan.pagos_realizados
        bank_hours_after_first = self.bank.horas_deuda
        snapshot_count_after_first = PayrollSnapshot.objects.count()

        second_response = self.client.post(self.commit_url, {'semana_num': 10, 'year': 2026}, format='json')

        self.assertEqual(second_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second_response.data['error'], 'Payroll week is already closed.')
        self.loan.refresh_from_db()
        self.bank.refresh_from_db()
        self.assertEqual(self.loan.pagos_realizados, loan_payments_after_first)
        self.assertEqual(self.bank.horas_deuda, bank_hours_after_first)
        self.assertEqual(PayrollSnapshot.objects.count(), snapshot_count_after_first)
        self.assertEqual(PayrollClosure.objects.count(), 1)

    def test_legacy_close_view_uses_duplicate_closure_protection(self):
        self.authenticate_with_group(self.finance_group)

        first_response = self.client.post(self.close_url, {'semana_num': 10, 'year': 2026}, format='json')
        second_response = self.client.post(self.close_url, {'semana_num': 10, 'year': 2026}, format='json')

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second_response.data['error'], 'Payroll week is already closed.')

    def test_snapshots_can_be_filtered_by_iso_year_and_semana_num(self):
        self.authenticate_with_group(self.finance_group)
        closure_2026 = PayrollClosure.objects.create(iso_year=2026, semana_num=10)
        closure_2027 = PayrollClosure.objects.create(iso_year=2027, semana_num=10)
        PayrollSnapshot.objects.create(
            iso_year=2026,
            semana_num=10,
            closure=closure_2026,
            empleado_no_nomina='EMP-SNAP-2026',
            empleado_nombre='Snapshot 2026',
            total_pagar=Decimal('100.00'),
            desglose={},
        )
        PayrollSnapshot.objects.create(
            iso_year=2027,
            semana_num=10,
            closure=closure_2027,
            empleado_no_nomina='EMP-SNAP-2027',
            empleado_nombre='Snapshot 2027',
            total_pagar=Decimal('200.00'),
            desglose={},
        )

        response = self.client.get(self.snapshots_url, {'iso_year': 2026, 'semana_num': 10})
        invalid_response = self.client.get(self.snapshots_url, {'iso_year': 'invalid', 'semana_num': 10})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['iso_year'], 2026)
        self.assertEqual(response.data[0]['semana_num'], 10)
        self.assertEqual(invalid_response.status_code, status.HTTP_200_OK)
        self.assertEqual(invalid_response.data, [])


class PayrollClosureModelTests(TestCase):
    def test_direct_non_dry_run_calculation_without_closure_is_rejected(self):
        with self.assertRaisesMessage(ValueError, "Payroll commits must use commit_payroll_for_week()."):
            calculate_payroll_for_week(10, dry_run=False, target_year=2026)

    def test_current_week_incidences_are_filtered_by_target_iso_year_dates(self):
        schedule = Schedule.objects.create(time_range="08:00-18:00")
        employee = Employee.objects.create(
            no_nomina="EMP-ISO-001",
            nombre="ISO Filter User",
            puesto="Operador",
            fecha_ingreso=datetime.date(2024, 1, 1),
            horario_lv=schedule,
        )
        absence = IncidenceCatalog.objects.create(tipo="Falta", abreviatura="F")
        target_date = datetime.date.fromisocalendar(2026, 11, 1)
        other_year_date = datetime.date.fromisocalendar(2025, 11, 1)
        IncidenceRecord.objects.create(
            fecha=target_date,
            semana_num=11,
            empleado=employee,
            tipo_incidencia=absence,
            cantidad=Decimal('1.00'),
        )
        IncidenceRecord.objects.create(
            fecha=other_year_date,
            semana_num=11,
            empleado=employee,
            tipo_incidencia=absence,
            cantidad=Decimal('1.00'),
        )

        results = calculate_payroll_for_week(11, dry_run=True, target_year=2026)

        self.assertEqual(len(results), 1)
        self.assertIn(target_date.isoformat(), results[0]['ausentismos'])
        self.assertNotIn(other_year_date.isoformat(), results[0]['ausentismos'])

    def test_closure_iso_year_week_is_unique(self):
        PayrollClosure.objects.create(iso_year=2026, semana_num=10)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PayrollClosure.objects.create(iso_year=2026, semana_num=10)

    def test_snapshot_can_exist_without_closure_for_historical_compatibility(self):
        snapshot = PayrollSnapshot.objects.create(
            semana_num=10,
            empleado_no_nomina='EMP-HIST-001',
            empleado_nombre='Historical User',
            total_pagar=Decimal('100.00'),
            desglose={},
        )

        self.assertIsNone(snapshot.iso_year)
        self.assertIsNone(snapshot.closure)

    def test_snapshot_can_be_associated_to_closure(self):
        closure = PayrollClosure.objects.create(
            iso_year=2026,
            semana_num=10,
            total_employees=1,
            total_amount=Decimal('100.00'),
        )
        snapshot = PayrollSnapshot.objects.create(
            iso_year=2026,
            semana_num=10,
            closure=closure,
            empleado_no_nomina='EMP-CLOSE-001',
            empleado_nombre='Closed User',
            total_pagar=Decimal('100.00'),
            desglose={},
        )

        self.assertEqual(snapshot.closure, closure)
        self.assertEqual(list(closure.snapshots.all()), [snapshot])

    def test_snapshot_closure_employee_is_unique(self):
        closure = PayrollClosure.objects.create(iso_year=2026, semana_num=10)
        PayrollSnapshot.objects.create(
            iso_year=2026,
            semana_num=10,
            closure=closure,
            empleado_no_nomina='EMP-DUP-001',
            empleado_nombre='Duplicate User',
            total_pagar=Decimal('100.00'),
            desglose={},
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PayrollSnapshot.objects.create(
                    iso_year=2026,
                    semana_num=10,
                    closure=closure,
                    empleado_no_nomina='EMP-DUP-001',
                    empleado_nombre='Duplicate User',
                    total_pagar=Decimal('200.00'),
                    desglose={},
                )

    def test_historical_snapshots_with_null_closure_can_duplicate_employee(self):
        PayrollSnapshot.objects.create(
            semana_num=10,
            empleado_no_nomina='EMP-HIST-DUP',
            empleado_nombre='Historical Duplicate',
            total_pagar=Decimal('100.00'),
            desglose={},
        )
        PayrollSnapshot.objects.create(
            semana_num=10,
            empleado_no_nomina='EMP-HIST-DUP',
            empleado_nombre='Historical Duplicate',
            total_pagar=Decimal('200.00'),
            desglose={},
        )

        self.assertEqual(
            PayrollSnapshot.objects.filter(closure__isnull=True, empleado_no_nomina='EMP-HIST-DUP').count(),
            2,
        )


@skipUnless(connection.vendor == 'postgresql', 'PayrollSnapshot immutability trigger is PostgreSQL-specific.')
class PayrollSnapshotImmutabilityTriggerTests(TransactionTestCase):
    def create_snapshot(self):
        return PayrollSnapshot.objects.create(
            iso_year=2026,
            semana_num=10,
            empleado_no_nomina='EMP-IMM-001',
            empleado_nombre='Immutable User',
            total_pagar=Decimal('100.00'),
            desglose={'source': 'test'},
        )

    def test_insert_still_works(self):
        snapshot = self.create_snapshot()

        self.assertIsNotNone(snapshot.pk)
        self.assertEqual(PayrollSnapshot.objects.count(), 1)

    def test_update_is_blocked_by_database_trigger(self):
        snapshot = self.create_snapshot()

        with self.assertRaises(DatabaseError) as exc:
            PayrollSnapshot.objects.filter(pk=snapshot.pk).update(total_pagar=Decimal('200.00'))

        self.assertIn('PayrollSnapshot is immutable and cannot be updated or deleted', str(exc.exception))

    def test_delete_is_blocked_by_database_trigger(self):
        snapshot = self.create_snapshot()

        with self.assertRaises(DatabaseError) as exc:
            PayrollSnapshot.objects.filter(pk=snapshot.pk).delete()

        self.assertIn('PayrollSnapshot is immutable and cannot be updated or deleted', str(exc.exception))
        self.assertTrue(PayrollSnapshot.objects.filter(pk=snapshot.pk).exists())


@skipUnless(connection.vendor == 'postgresql', 'Supabase RLS hardening is PostgreSQL-specific.')
class SupabaseRLSHardeningTests(TransactionTestCase):
    sensitive_tables = (
        'payroll_employee',
        'payroll_incidencerecord',
        'payroll_loan',
        'payroll_extrahourbank',
        'payroll_payrollsnapshot',
        'payroll_payrollclosure',
        'payroll_incidencecatalog',
        'payroll_schedule',
    )

    def test_sensitive_tables_have_rls_enabled_without_force_rls(self):
        with connection.cursor() as cursor:
            for table_name in self.sensitive_tables:
                cursor.execute(
                    """
                    SELECT c.relrowsecurity, c.relforcerowsecurity
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = %s
                    """,
                    [table_name],
                )
                row = cursor.fetchone()

                self.assertIsNotNone(row, f'{table_name} should exist in public schema.')
                self.assertTrue(row[0], f'{table_name} should have row level security enabled.')
                self.assertFalse(row[1], f'{table_name} should not force row level security yet.')

    def test_supabase_public_roles_do_not_have_table_privileges(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')"
            )
            roles = [row[0] for row in cursor.fetchall()]

            for role in roles:
                for table_name in self.sensitive_tables:
                    for privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE'):
                        cursor.execute(
                            "SELECT has_table_privilege(%s, %s, %s)",
                            [role, f'public.{table_name}', privilege],
                        )
                        self.assertFalse(
                            cursor.fetchone()[0],
                            f'{role} should not have {privilege} on {table_name}.',
                        )

    def test_supabase_public_roles_do_not_have_sequence_privileges(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')"
            )
            roles = [row[0] for row in cursor.fetchall()]

            cursor.execute(
                """
                SELECT DISTINCT seq_ns.nspname, seq.relname
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
                  AND tbl.relname = ANY (%s)
                """,
                [list(self.sensitive_tables)],
            )
            sequence_names = [f'{schema}.{name}' for schema, name in cursor.fetchall()]

            for sequence_name in sequence_names:
                for role in roles:
                    for privilege in ('USAGE', 'SELECT', 'UPDATE'):
                        cursor.execute(
                            "SELECT has_sequence_privilege(%s, %s, %s)",
                            [role, sequence_name, privilege],
                        )
                        self.assertFalse(
                            cursor.fetchone()[0],
                            f'{role} should not have {privilege} on {sequence_name}.',
                        )


class LoanBusinessRuleTests(APITestCase):
    loans_url = '/api/payroll/loans/'

    def setUp(self):
        self.hr_group = Group.objects.get_or_create(name=HR_CAPTURE)[0]
        self.user = User.objects.create_user(username='loan_tester', password='testpassword')
        self.user.groups.add(self.hr_group)
        self.client.force_authenticate(user=self.user)
        self.schedule = Schedule.objects.create(time_range="08:00-18:00")
        self.employee = Employee.objects.create(
            no_nomina="EMP-LOAN-001",
            nombre="Loan User",
            puesto="Operador",
            fecha_ingreso=datetime.date(2024, 1, 1),
            horario_lv=self.schedule,
        )

    def test_inactive_employee_is_not_included_in_payroll_calculation(self):
        inactive_employee = Employee.objects.create(
            no_nomina="EMP-INACTIVE-001",
            nombre="Inactive User",
            puesto="Operador",
            fecha_ingreso=datetime.date(2024, 1, 1),
            is_active=False,
            horario_lv=self.schedule,
        )
        Loan.objects.create(
            empleado=inactive_employee,
            monto_total=Decimal('100.00'),
            abono_semanal=Decimal('25.00'),
            pagos_realizados=0,
            is_active=True,
        )

        results = calculate_payroll_for_week(11, dry_run=True, target_year=2026)

        self.assertEqual(results, [])

    def test_calculation_ignores_inactive_loan(self):
        Loan.objects.create(
            empleado=self.employee,
            monto_total=Decimal('100.00'),
            abono_semanal=Decimal('25.00'),
            pagos_realizados=0,
            is_active=False,
        )

        results = calculate_payroll_for_week(11, dry_run=True, target_year=2026)

        self.assertEqual(results, [])

    def test_api_rejects_second_active_loan_for_same_employee(self):
        Loan.objects.create(
            empleado=self.employee,
            monto_total=Decimal('100.00'),
            abono_semanal=Decimal('25.00'),
            pagos_realizados=0,
            is_active=True,
        )

        response = self.client.post(self.loans_url, {
            'empleado': self.employee.no_nomina,
            'monto_total': '200.00',
            'abono_semanal': '50.00',
            'pagos_realizados': 0,
            'is_active': True,
            'status': 'PENDIENTE',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('empleado', response.data)

    def test_updating_same_active_loan_does_not_fail_false_positive(self):
        loan = Loan.objects.create(
            empleado=self.employee,
            monto_total=Decimal('100.00'),
            abono_semanal=Decimal('25.00'),
            pagos_realizados=0,
            is_active=True,
        )

        response = self.client.patch(
            f'{self.loans_url}{loan.id}/',
            {'monto_total': '150.00'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_db_constraint_rejects_second_active_loan_for_same_employee(self):
        Loan.objects.create(
            empleado=self.employee,
            monto_total=Decimal('100.00'),
            abono_semanal=Decimal('25.00'),
            pagos_realizados=0,
            is_active=True,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Loan.objects.create(
                    empleado=self.employee,
                    monto_total=Decimal('200.00'),
                    abono_semanal=Decimal('50.00'),
                    pagos_realizados=0,
                    is_active=True,
                )
