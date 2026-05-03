from io import StringIO

from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from payroll.permissions import FINANCE_ADMIN, HR_CAPTURE


class HealthCheckTests(APITestCase):
    def test_health_check_returns_ok(self):
        response = self.client.get('/health/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['status'], 'ok')


class BootstrapRolesTests(TestCase):
    def setUp(self):
        Group.objects.filter(name__in=[HR_CAPTURE, FINANCE_ADMIN]).delete()

    def call_bootstrap_roles(self):
        output = StringIO()
        call_command('bootstrap_roles', stdout=output)
        return output.getvalue()

    def test_bootstrap_roles_creates_required_groups(self):
        output = self.call_bootstrap_roles()

        self.assertTrue(Group.objects.filter(name=HR_CAPTURE).exists())
        self.assertTrue(Group.objects.filter(name=FINANCE_ADMIN).exists())
        self.assertIn('created=2', output)

    def test_bootstrap_roles_is_idempotent(self):
        self.call_bootstrap_roles()
        first_count = Group.objects.filter(name__in=[HR_CAPTURE, FINANCE_ADMIN]).count()

        output = self.call_bootstrap_roles()
        second_count = Group.objects.filter(name__in=[HR_CAPTURE, FINANCE_ADMIN]).count()

        self.assertEqual(first_count, 2)
        self.assertEqual(second_count, 2)
        self.assertIn('created=0', output)
        self.assertIn('existing=2', output)

    def test_bootstrap_roles_does_not_create_users(self):
        self.call_bootstrap_roles()

        self.assertEqual(User.objects.count(), 0)
