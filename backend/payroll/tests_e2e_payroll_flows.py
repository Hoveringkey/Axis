import datetime
from io import StringIO

from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from payroll.models import PayrollClosure, PayrollSnapshot


@override_settings(DEBUG=True)
class PayrollE2EFlowTests(APITestCase):
    token_url = "/api/token/"
    me_url = "/api/auth/me/"
    dashboard_url = "/api/payroll/dashboard/"
    current_week_url = "/api/payroll/current-week/"
    preview_url = "/api/payroll/preview/"
    commit_url = "/api/payroll/commit/"
    snapshots_url = "/api/payroll/snapshots/"
    demo_password = "AxisDemo123!"

    def setUp(self):
        self.current_iso_year, self.current_week, _ = datetime.date.today().isocalendar()
        call_command("seed_dev", stdout=StringIO())

    def login(self, username):
        response = self.client.post(
            self.token_url,
            {"username": username, "password": self.demo_password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response.data["access"]

    def response_items(self, response):
        data = response.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def test_demo_users_can_obtain_real_jwt_tokens(self):
        for username in ("hr_demo", "finance_demo", "admin_demo"):
            with self.subTest(username=username):
                response = self.client.post(
                    self.token_url,
                    {"username": username, "password": self.demo_password},
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertIn("access", response.data)

    def test_hr_payroll_flow_uses_real_jwt_and_cannot_commit(self):
        self.login("hr_demo")

        me_response = self.client.get(self.me_url)
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        permissions = me_response.data["permissions"]
        self.assertTrue(permissions["can_access_payroll"])
        self.assertTrue(permissions["can_capture_hr"])
        self.assertFalse(permissions["can_manage_payroll"])

        dashboard_response = self.client.get(self.dashboard_url)
        self.assertEqual(dashboard_response.status_code, status.HTTP_200_OK)

        week_response = self.client.get(self.current_week_url)
        self.assertEqual(week_response.status_code, status.HTTP_200_OK)
        self.assertIn("current_week", week_response.data)
        self.assertIn("current_iso_year", week_response.data)
        self.assertIn("label", week_response.data)

        preview_response = self.client.get(
            self.preview_url,
            {"semana_num": self.current_week, "year": self.current_iso_year},
        )
        self.assertEqual(preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(PayrollClosure.objects.count(), 0)
        self.assertEqual(PayrollSnapshot.objects.count(), 0)

        commit_response = self.client.post(
            self.commit_url,
            {"semana_num": self.current_week, "year": self.current_iso_year},
            format="json",
        )
        self.assertEqual(commit_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_finance_payroll_flow_commits_and_rejects_duplicate_commit(self):
        self.login("finance_demo")

        me_response = self.client.get(self.me_url)
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        permissions = me_response.data["permissions"]
        self.assertTrue(permissions["can_access_payroll"])
        self.assertTrue(permissions["can_manage_payroll"])

        preview_response = self.client.get(
            self.preview_url,
            {"semana_num": self.current_week, "year": self.current_iso_year},
        )
        self.assertEqual(preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(PayrollClosure.objects.count(), 0)
        self.assertEqual(PayrollSnapshot.objects.count(), 0)

        commit_response = self.client.post(
            self.commit_url,
            {"semana_num": self.current_week, "year": self.current_iso_year},
            format="json",
        )
        self.assertEqual(commit_response.status_code, status.HTTP_200_OK)

        closure = PayrollClosure.objects.get(
            semana_num=self.current_week,
            iso_year=self.current_iso_year,
        )
        snapshot_count = PayrollSnapshot.objects.filter(
            semana_num=self.current_week,
            iso_year=self.current_iso_year,
            closure=closure,
        ).count()
        self.assertGreater(snapshot_count, 0)

        snapshots_response = self.client.get(
            self.snapshots_url,
            {"semana_num": self.current_week, "iso_year": self.current_iso_year},
        )
        self.assertEqual(snapshots_response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(self.response_items(snapshots_response)), 0)

        duplicate_response = self.client.post(
            self.commit_url,
            {"semana_num": self.current_week, "year": self.current_iso_year},
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_409_CONFLICT)

    def test_payroll_endpoints_require_authentication(self):
        dashboard_response = self.client.get(self.dashboard_url)
        preview_response = self.client.get(
            self.preview_url,
            {"semana_num": self.current_week, "year": self.current_iso_year},
        )
        commit_response = self.client.post(
            self.commit_url,
            {"semana_num": self.current_week, "year": self.current_iso_year},
            format="json",
        )

        self.assertEqual(dashboard_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(preview_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(commit_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_payroll_inputs_return_400_for_finance_user(self):
        self.login("finance_demo")

        cases = [
            ("preview_missing_week", "get", self.preview_url, {"year": self.current_iso_year}),
            ("preview_week_zero", "get", self.preview_url, {"semana_num": 0, "year": self.current_iso_year}),
            ("preview_invalid_year", "get", self.preview_url, {"semana_num": self.current_week, "year": "invalid"}),
            ("commit_missing_week", "post", self.commit_url, {"year": self.current_iso_year}),
            ("commit_week_54", "post", self.commit_url, {"semana_num": 54, "year": self.current_iso_year}),
        ]

        for name, method, url, payload in cases:
            with self.subTest(name=name):
                if method == "get":
                    response = self.client.get(url, payload)
                else:
                    response = self.client.post(url, payload, format="json")

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
