import datetime
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from payroll.models import (
    Employee,
    ExtraHourBank,
    IncidenceCatalog,
    IncidenceRecord,
    Loan,
    Schedule,
)
from payroll.permissions import FINANCE_ADMIN, HR_CAPTURE


DEMO_PASSWORD = "AxisDemo123!"


class Command(BaseCommand):
    help = "Seed safe, reproducible development data for local Axis environments."

    def add_arguments(self, parser):
        parser.add_argument(
            "--allow-production",
            action="store_true",
            help="Allow this development seed to run when DEBUG=False.",
        )

    def handle(self, *args, **options):
        allow_production = options["allow_production"]

        if not settings.DEBUG and not allow_production:
            raise CommandError(
                "seed_dev is blocked because DEBUG=False. "
                "Use --allow-production only when you explicitly intend to modify this database."
            )

        if allow_production:
            self.stdout.write(self.style.WARNING(
                "WARNING: --allow-production was used. seed_dev will modify this database "
                "even though it is intended only for development seed data."
            ))

        with transaction.atomic():
            summary = {
                "groups_created": 0,
                "groups_updated": 0,
                "users_created": 0,
                "users_updated": 0,
                "schedules_created": 0,
                "schedules_existing": 0,
                "catalog_created": 0,
                "catalog_updated": 0,
                "employees_created": 0,
                "employees_updated": 0,
                "incidences_created": 0,
                "incidences_omitted": 0,
                "loans_created": 0,
                "loans_updated": 0,
                "banks_created": 0,
                "banks_updated": 0,
            }

            groups = self._seed_groups(summary)
            self._seed_users(groups, summary)
            schedules = self._seed_schedules(summary)
            catalog = self._seed_catalog(summary)
            employees = self._seed_employees(schedules, summary)
            self._seed_incidences(employees, catalog, summary)
            self._seed_loans(employees, summary)
            self._seed_extra_hour_banks(employees, summary)

        self._write_summary(summary)

    def _seed_groups(self, summary):
        groups = {}
        for name in (HR_CAPTURE, FINANCE_ADMIN):
            group, created = Group.objects.get_or_create(name=name)
            groups[name] = group
            if created:
                summary["groups_created"] += 1
            else:
                summary["groups_updated"] += 1
        return groups

    def _seed_users(self, groups, summary):
        user_specs = [
            {
                "username": "hr_demo",
                "groups": [groups[HR_CAPTURE]],
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "username": "finance_demo",
                "groups": [groups[FINANCE_ADMIN]],
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "username": "admin_demo",
                "groups": [],
                "is_staff": True,
                "is_superuser": True,
            },
        ]

        for spec in user_specs:
            user, created = User.objects.get_or_create(
                username=spec["username"],
                defaults={
                    "is_staff": spec["is_staff"],
                    "is_superuser": spec["is_superuser"],
                    "is_active": True,
                },
            )
            user.is_staff = spec["is_staff"]
            user.is_superuser = spec["is_superuser"]
            user.is_active = True
            user.set_password(DEMO_PASSWORD)
            user.save()
            user.groups.set(spec["groups"])

            if created:
                summary["users_created"] += 1
            else:
                summary["users_updated"] += 1

    def _seed_schedules(self, summary):
        schedules = {}
        for time_range in ("06:00 - 14:00", "14:00 - 21:30", "21:30 - 06:00"):
            schedule, created = Schedule.objects.get_or_create(time_range=time_range)
            schedules[time_range] = schedule
            if created:
                summary["schedules_created"] += 1
            else:
                summary["schedules_existing"] += 1
        return schedules

    def _seed_catalog(self, summary):
        catalog_specs = [
            ("F", "Falta"),
            ("PSG", "Permiso sin goce"),
            ("I", "Incapacidad"),
            ("V", "Vacaciones"),
            ("HX", "Horas extra"),
            ("DA", "Día abastecedor"),
            ("ASU", "Asueto"),
        ]

        catalog = {}
        for abbreviation, name in catalog_specs:
            incidence_type = IncidenceCatalog.objects.filter(
                abreviatura=abbreviation
            ).order_by("id").first()

            if incidence_type is None:
                incidence_type = IncidenceCatalog.objects.create(
                    abreviatura=abbreviation,
                    tipo=name,
                )
                summary["catalog_created"] += 1
            else:
                incidence_type.tipo = name
                incidence_type.save(update_fields=["tipo"])
                summary["catalog_updated"] += 1

            catalog[abbreviation] = incidence_type
        return catalog

    def _seed_employees(self, schedules, summary):
        employee_specs = [
            ("DEMO-001", "Demo Alba Ruiz", "A", datetime.date(2018, 1, 15), "06:00 - 14:00"),
            ("DEMO-002", "Demo Bruno Vega", "C", datetime.date(2019, 6, 3), "14:00 - 21:30"),
            ("DEMO-003", "Demo Carla Soto", "A", datetime.date(2020, 11, 20), "21:30 - 06:00"),
            ("DEMO-004", "Demo Diego Mora", "C", datetime.date(2021, 4, 8), "06:00 - 14:00"),
            ("DEMO-005", "Demo Elena Paz", "A", datetime.date(2022, 8, 29), "14:00 - 21:30"),
            ("DEMO-006", "Demo Felix Cano", "C", datetime.date(2023, 2, 10), "21:30 - 06:00"),
            ("DEMO-007", "Demo Gabriela Rios", "A", datetime.date(2024, 5, 27), "06:00 - 14:00"),
            ("DEMO-008", "Demo Hector Luna", "C", datetime.date(2025, 9, 12), "21:30 - 06:00"),
        ]

        employees = {}
        for no_nomina, name, puesto, start_date, schedule_name in employee_specs:
            employee, created = Employee.objects.update_or_create(
                no_nomina=no_nomina,
                defaults={
                    "nombre": name,
                    "puesto": puesto,
                    "fecha_ingreso": start_date,
                    "is_active": True,
                    "fecha_baja": None,
                    "motivo_baja": None,
                    "horario_lv": schedules[schedule_name],
                    "horario_s": None,
                    "vacaciones_historicas_disfrutadas": 0,
                },
            )
            employees[no_nomina] = employee
            if created:
                summary["employees_created"] += 1
            else:
                summary["employees_updated"] += 1
        return employees

    def _seed_incidences(self, employees, catalog, summary):
        today = datetime.date.today()
        current_year, current_week, _ = today.isocalendar()
        previous_date = today - datetime.timedelta(weeks=1)
        previous_year, previous_week, _ = previous_date.isocalendar()

        incidence_specs = [
            ("DEMO-001", catalog["F"], current_year, current_week, 1, "1.00"),
            ("DEMO-002", catalog["PSG"], current_year, current_week, 2, "1.00"),
            ("DEMO-003", catalog["V"], current_year, current_week, 3, "1.00"),
            ("DEMO-004", catalog["HX"], current_year, current_week, 4, "2.50"),
            ("DEMO-005", catalog["DA"], current_year, current_week, 5, "1.00"),
            ("DEMO-006", catalog["HX"], previous_year, previous_week, 2, "3.00"),
            ("DEMO-007", catalog["F"], previous_year, previous_week, 3, "1.00"),
        ]

        for no_nomina, incidence_type, iso_year, iso_week, iso_day, quantity in incidence_specs:
            incidence_date = datetime.date.fromisocalendar(iso_year, iso_week, iso_day)
            _, created = IncidenceRecord.objects.update_or_create(
                empleado=employees[no_nomina],
                fecha=incidence_date,
                tipo_incidencia=incidence_type,
                defaults={
                    "semana_num": iso_week,
                    "cantidad": Decimal(quantity),
                },
            )
            if created:
                summary["incidences_created"] += 1
            else:
                summary["incidences_omitted"] += 1

    def _seed_loans(self, employees, summary):
        loan_specs = [
            ("DEMO-002", Decimal("1200.00"), Decimal("150.00"), 1),
            ("DEMO-006", Decimal("800.00"), Decimal("100.00"), 0),
        ]

        for no_nomina, total, weekly_payment, payments_done in loan_specs:
            employee = employees[no_nomina]
            loan = Loan.objects.filter(empleado=employee, is_active=True).first()
            if loan is None:
                Loan.objects.create(
                    empleado=employee,
                    monto_total=total,
                    abono_semanal=weekly_payment,
                    pagos_realizados=payments_done,
                    is_active=True,
                    status="PENDIENTE",
                )
                summary["loans_created"] += 1
            else:
                loan.monto_total = total
                loan.abono_semanal = weekly_payment
                loan.pagos_realizados = payments_done
                loan.is_active = True
                loan.status = "PENDIENTE"
                loan.save(update_fields=[
                    "monto_total",
                    "abono_semanal",
                    "pagos_realizados",
                    "is_active",
                    "status",
                ])
                summary["loans_updated"] += 1

    def _seed_extra_hour_banks(self, employees, summary):
        bank_specs = [
            ("DEMO-004", Decimal("4.50")),
        ]

        for no_nomina, hours in bank_specs:
            employee = employees[no_nomina]
            bank = ExtraHourBank.objects.filter(empleado=employee).order_by("id").first()
            if bank is None:
                ExtraHourBank.objects.create(empleado=employee, horas_deuda=hours)
                summary["banks_created"] += 1
            else:
                bank.horas_deuda = hours
                bank.save(update_fields=["horas_deuda"])
                summary["banks_updated"] += 1

    def _write_summary(self, summary):
        self.stdout.write(self.style.SUCCESS("seed_dev completed."))
        self.stdout.write(
            f"grupos creados/actualizados: {summary['groups_created']}/{summary['groups_updated']}"
        )
        self.stdout.write(
            f"usuarios creados/actualizados: {summary['users_created']}/{summary['users_updated']}"
        )
        self.stdout.write(
            f"horarios creados/existentes: {summary['schedules_created']}/{summary['schedules_existing']}"
        )
        self.stdout.write(
            f"catalogos creados/actualizados: {summary['catalog_created']}/{summary['catalog_updated']}"
        )
        self.stdout.write(
            f"empleados creados/actualizados: {summary['employees_created']}/{summary['employees_updated']}"
        )
        self.stdout.write(
            f"incidencias creadas/omitidas: {summary['incidences_created']}/{summary['incidences_omitted']}"
        )
        self.stdout.write(
            f"prestamos creados/actualizados: {summary['loans_created']}/{summary['loans_updated']}"
        )
        self.stdout.write(
            f"bancos HX creados/actualizados: {summary['banks_created']}/{summary['banks_updated']}"
        )
