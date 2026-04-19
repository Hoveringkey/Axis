from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Employee

class EmployeeBulkCreateTests(APITestCase):
    def setUp(self):
        # Create user and authenticate with JWT token
        self.user = User.objects.create_user(username='testadmin', password='testpassword')
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        self.url = reverse('employee-bulk-create')

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
            "horario_s": "" # empty string test
        }
        self.valid_employee_4 = {
            "no_nomina": "EMP-004",
            "nombre": "Ana Gomez",
            "puesto": "Almacen",
            "horario_lv": "08:00-18:00"
            # omitted field test
        }

    def test_setup_works(self):
        self.assertEqual(self.url, reverse('employee-bulk-create'))

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
        self.assertEqual(emp1.horario_s, "08:00-13:00")

        emp2 = Employee.objects.get(no_nomina="EMP-002")
        self.assertIsNone(emp2.horario_s)

        emp3 = Employee.objects.get(no_nomina="EMP-003")
        self.assertEqual(emp3.horario_s, "")

        emp4 = Employee.objects.get(no_nomina="EMP-004")
        self.assertIn(emp4.horario_s, [None, ""])

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
