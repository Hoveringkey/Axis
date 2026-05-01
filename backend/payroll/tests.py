import datetime
from decimal import Decimal
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import Group, User
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Employee, ExtraHourBank, Loan, PayrollSnapshot, Schedule
from .permissions import FINANCE_ADMIN, HR_CAPTURE
from .services import safe_replace_year

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
