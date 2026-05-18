"""
Phase D — backend action-level permission tests.

Covers:
- LoanViewSet: DELETE blocked (405); PATCH gated to FINANCE_ADMIN.
- IncidenceCatalogViewSet: read-only via REST.
- ExtraHourBankViewSet: read-only via REST.
- IncidenceRecordViewSet: mutations (create/update/delete/bulk_asueto) on a
  closed week return 409 regardless of role.
"""
import datetime
from decimal import Decimal

from django.contrib.auth.models import Group, User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Employee,
    ExtraHourBank,
    IncidenceCatalog,
    IncidenceRecord,
    Loan,
    PayrollClosure,
    Schedule,
)
from .permissions import FINANCE_ADMIN, HR_CAPTURE


# 2024 ISO weeks chosen so isocalendar() lands cleanly on Mondays.
CLOSED_WEEK_DATE = datetime.date(2024, 3, 4)   # (2024, 10, 1)
CLOSED_WEEK_NUM = 10
OPEN_WEEK_DATE = datetime.date(2024, 5, 13)    # (2024, 20, 1)
OPEN_WEEK_NUM = 20


def _make_users():
    hr_group = Group.objects.get_or_create(name=HR_CAPTURE)[0]
    finance_group = Group.objects.get_or_create(name=FINANCE_ADMIN)[0]
    hr_user = User.objects.create_user(username='action_hr', password='pw')
    hr_user.groups.add(hr_group)
    finance_user = User.objects.create_user(username='action_finance', password='pw')
    finance_user.groups.add(finance_group)
    return hr_user, finance_user


def _make_employee(no_nomina='ACT-001', nombre='Action Tester'):
    schedule = Schedule.objects.get_or_create(time_range='08:00-18:00')[0]
    return Employee.objects.create(
        no_nomina=no_nomina,
        nombre=nombre,
        puesto='Operador',
        fecha_ingreso=datetime.date(2024, 1, 1),
        horario_lv=schedule,
    )


class LoanActionPermissionTests(APITestCase):
    """LoanViewSet: DELETE → 405; PATCH → Finance-only; GET/POST → both roles."""

    loans_url = '/api/payroll/loans/'

    def setUp(self):
        self.hr_user, self.finance_user = _make_users()
        self.employee = _make_employee('ACT-LOAN-001')
        self.loan = Loan.objects.create(
            empleado=self.employee,
            monto_total=Decimal('100.00'),
            abono_semanal=Decimal('25.00'),
            pagos_realizados=0,
            is_active=True,
        )

    def test_hr_can_list_loans(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.get(self.loans_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_hr_can_create_loan(self):
        other = _make_employee('ACT-LOAN-002', 'Other')
        self.client.force_authenticate(self.hr_user)
        resp = self.client.post(self.loans_url, {
            'empleado': other.no_nomina,
            'monto_total': '500.00',
            'abono_semanal': '50.00',
            'pagos_realizados': 0,
            'is_active': True,
            'status': 'PENDIENTE',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_hr_cannot_patch_loan(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.patch(
            f'{self.loans_url}{self.loan.id}/',
            {'monto_total': '150.00'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_finance_can_patch_loan(self):
        self.client.force_authenticate(self.finance_user)
        resp = self.client.patch(
            f'{self.loans_url}{self.loan.id}/',
            {'monto_total': '175.00'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_delete_loan_returns_405_for_hr(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.delete(f'{self.loans_url}{self.loan.id}/')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_delete_loan_returns_405_for_finance(self):
        self.client.force_authenticate(self.finance_user)
        resp = self.client.delete(f'{self.loans_url}{self.loan.id}/')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class ExtraHourBankActionPermissionTests(APITestCase):
    """ExtraHourBankViewSet: read-only via REST (ORM mutations from services unaffected)."""

    base_url = '/api/payroll/extra-hour-banks/'

    def setUp(self):
        self.hr_user, self.finance_user = _make_users()
        self.employee = _make_employee('ACT-EHB-001')
        self.bank = ExtraHourBank.objects.create(
            empleado=self.employee,
            horas_deuda=Decimal('2.00'),
        )

    def test_hr_can_list(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.get(self.base_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_hr_can_retrieve(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.get(f'{self.base_url}{self.bank.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_post_returns_405_for_hr(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.post(self.base_url, {
            'empleado': self.employee.no_nomina,
            'horas_deuda': '1.00',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_patch_returns_405_for_finance(self):
        self.client.force_authenticate(self.finance_user)
        resp = self.client.patch(
            f'{self.base_url}{self.bank.id}/',
            {'horas_deuda': '5.00'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_delete_returns_405_for_finance(self):
        self.client.force_authenticate(self.finance_user)
        resp = self.client.delete(f'{self.base_url}{self.bank.id}/')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class IncidenceCatalogActionPermissionTests(APITestCase):
    """IncidenceCatalogViewSet: read-only via REST."""

    base_url = '/api/payroll/incidence-catalogs/'

    def setUp(self):
        self.hr_user, self.finance_user = _make_users()
        self.catalog = IncidenceCatalog.objects.create(tipo='Vacaciones', abreviatura='VAC')

    def test_hr_can_list(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.get(self.base_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_post_returns_405_for_hr(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.post(self.base_url, {
            'tipo': 'Permiso',
            'abreviatura': 'PER',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_patch_returns_405_for_finance(self):
        self.client.force_authenticate(self.finance_user)
        resp = self.client.patch(
            f'{self.base_url}{self.catalog.id}/',
            {'tipo': 'Algo'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_delete_returns_405_for_finance(self):
        self.client.force_authenticate(self.finance_user)
        resp = self.client.delete(f'{self.base_url}{self.catalog.id}/')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class IncidenceRecordClosureGuardTests(APITestCase):
    """IncidenceRecordViewSet: closed-week mutations return 409 (create, update, delete, bulk_asueto)."""

    base_url = '/api/payroll/incidence-records/'
    bulk_asueto_url = '/api/payroll/incidence-records/bulk_asueto/'

    def setUp(self):
        self.hr_user, self.finance_user = _make_users()
        self.employee = _make_employee('ACT-INC-001')
        self.catalog = IncidenceCatalog.objects.create(tipo='Falta', abreviatura='FAL')
        # ASU catalog needed for bulk_asueto endpoint.
        self.asueto_catalog = IncidenceCatalog.objects.create(tipo='Asueto', abreviatura='ASU')

        # Closed week setup: closure row + an existing IncidenceRecord on that week.
        PayrollClosure.objects.create(
            iso_year=CLOSED_WEEK_DATE.isocalendar()[0],
            semana_num=CLOSED_WEEK_NUM,
            total_employees=1,
            total_amount=Decimal('0.00'),
        )
        self.closed_record = IncidenceRecord.objects.create(
            fecha=CLOSED_WEEK_DATE,
            semana_num=CLOSED_WEEK_NUM,
            empleado=self.employee,
            tipo_incidencia=self.catalog,
            cantidad=Decimal('1.00'),
        )

        # Open week: existing record we can safely mutate.
        self.open_record = IncidenceRecord.objects.create(
            fecha=OPEN_WEEK_DATE,
            semana_num=OPEN_WEEK_NUM,
            empleado=self.employee,
            tipo_incidencia=self.catalog,
            cantidad=Decimal('1.00'),
        )

    # ── Control cases: open week still works ────────────────────────────────

    def test_patch_on_open_week_succeeds_hr(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.patch(
            f'{self.base_url}{self.open_record.id}/',
            {'cantidad': '0.50'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_delete_on_open_week_succeeds_hr(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.delete(f'{self.base_url}{self.open_record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_post_on_open_week_succeeds(self):
        # New record on open week, different tipo_incidencia to avoid unique_together.
        other_catalog = IncidenceCatalog.objects.create(tipo='Permiso', abreviatura='PER')
        self.client.force_authenticate(self.hr_user)
        resp = self.client.post(self.base_url, {
            'fecha': OPEN_WEEK_DATE.isoformat(),
            'semana_num': OPEN_WEEK_NUM,
            'empleado': self.employee.no_nomina,
            'tipo_incidencia': other_catalog.id,
            'cantidad': '1.00',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_bulk_asueto_on_open_week_succeeds(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.post(self.bulk_asueto_url, {
            'fecha': OPEN_WEEK_DATE.isoformat(),
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    # ── Closure-guard cases: 409 regardless of role ─────────────────────────

    def test_patch_on_closed_week_returns_409_for_hr(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.patch(
            f'{self.base_url}{self.closed_record.id}/',
            {'cantidad': '0.50'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data.get('code') or getattr(resp.data.get('detail'), 'code', None), 'week_closed')

    def test_delete_on_closed_week_returns_409_for_hr(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.delete(f'{self.base_url}{self.closed_record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_patch_on_closed_week_returns_409_for_finance(self):
        self.client.force_authenticate(self.finance_user)
        resp = self.client.patch(
            f'{self.base_url}{self.closed_record.id}/',
            {'cantidad': '0.50'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_delete_on_closed_week_returns_409_for_finance(self):
        self.client.force_authenticate(self.finance_user)
        resp = self.client.delete(f'{self.base_url}{self.closed_record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_post_on_closed_week_returns_409(self):
        # Try to create a new record dated within the closed week, different tipo to dodge unique_together.
        other_catalog = IncidenceCatalog.objects.create(tipo='Retardo', abreviatura='RET')
        self.client.force_authenticate(self.hr_user)
        resp = self.client.post(self.base_url, {
            'fecha': CLOSED_WEEK_DATE.isoformat(),
            'semana_num': CLOSED_WEEK_NUM,
            'empleado': self.employee.no_nomina,
            'tipo_incidencia': other_catalog.id,
            'cantidad': '1.00',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_bulk_asueto_on_closed_week_returns_409(self):
        self.client.force_authenticate(self.hr_user)
        resp = self.client.post(self.bulk_asueto_url, {
            'fecha': CLOSED_WEEK_DATE.isoformat(),
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    # ── Cross-week mutation guard: payload fecha into a closed week ─────────

    def test_patch_changing_fecha_to_closed_week_returns_409(self):
        """PATCH on an open-week record that re-targets fecha into a closed week → 409."""
        self.client.force_authenticate(self.hr_user)
        resp = self.client.patch(
            f'{self.base_url}{self.open_record.id}/',
            {'fecha': CLOSED_WEEK_DATE.isoformat()},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_put_changing_fecha_to_closed_week_returns_409(self):
        """PUT on an open-week record that re-targets fecha into a closed week → 409."""
        self.client.force_authenticate(self.hr_user)
        resp = self.client.put(
            f'{self.base_url}{self.open_record.id}/',
            {
                'fecha': CLOSED_WEEK_DATE.isoformat(),
                'semana_num': CLOSED_WEEK_NUM,
                'empleado': self.employee.no_nomina,
                'tipo_incidencia': self.catalog.id,
                'cantidad': '1.00',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_patch_changing_only_cantidad_on_open_week_succeeds(self):
        """PATCH on an open-week record changing only `cantidad` stays 200."""
        self.client.force_authenticate(self.hr_user)
        resp = self.client.patch(
            f'{self.base_url}{self.open_record.id}/',
            {'cantidad': '0.75'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_patch_with_invalid_fecha_returns_400_not_409(self):
        """Malformed `fecha` in payload falls through to serializer → 400, not 409."""
        self.client.force_authenticate(self.hr_user)
        resp = self.client.patch(
            f'{self.base_url}{self.open_record.id}/',
            {'fecha': 'not-a-date'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
