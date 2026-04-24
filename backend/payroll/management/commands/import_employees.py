import csv
import datetime
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from payroll.models import Employee, Schedule
from pathlib import Path

class Command(BaseCommand):
    help = 'Unified master ETL to onboard employees, map schedules, and migrate historical LFT data.'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='The path to the master CSV file (e.g., datos_empleados.csv)')

    def handle(self, *args, **options):
        csv_file_path = options['csv_file']

        if not Path(csv_file_path).is_file():
            self.stdout.write(self.style.ERROR(f'File not found: {csv_file_path}'))
            return

        created_count = 0
        updated_count = 0

        try:
            with open(csv_file_path, mode='r', encoding='utf-8-sig') as file:
                # Use a custom DictReader to handle whitespace in headers
                reader = csv.DictReader(file)
                
                # Sanitize headers immediately
                reader.fieldnames = [name.strip() for name in reader.fieldnames if name]
                
                with transaction.atomic():
                    for row in reader:
                        # Sanitize values (strip whitespaces and handle None)
                        # We use .get() to avoid KeyErrors if a header was missing after strip
                        data = {k: v.strip() if v else '' for k, v in row.items() if k}
                        
                        no_nomina = data.get('no_nomina')
                        if not no_nomina:
                            continue
                            
                        # Schedules: get_or_create logic
                        horario_lv_str = data.get('horario_l_v')
                        horario_lv = None
                        if horario_lv_str:
                            horario_lv, _ = Schedule.objects.get_or_create(time_range=horario_lv_str)
                            
                        horario_s_str = data.get('horario_s')
                        horario_s = None
                        if horario_s_str:
                            horario_s, _ = Schedule.objects.get_or_create(time_range=horario_s_str)
                            
                        # Date parsing: strict M/D/YYYY
                        fecha_ingreso_str = data.get('fecha_ingreso')
                        fecha_ingreso = None
                        if fecha_ingreso_str:
                            try:
                                fecha_ingreso = datetime.datetime.strptime(fecha_ingreso_str, '%m/%d/%Y').date()
                            except ValueError:
                                self.stdout.write(self.style.WARNING(f"Invalid date format for employee {no_nomina}: '{fecha_ingreso_str}'. Expected M/D/YYYY."))
                        
                        # Vacations: cast to int
                        vacaciones_str = data.get('total_vacaciones_disfrutadas')
                        vacaciones = 0
                        if vacaciones_str:
                            try:
                                vacaciones = int(vacaciones_str)
                            except ValueError:
                                self.stdout.write(self.style.WARNING(f"Invalid vacation count for employee {no_nomina}: '{vacaciones_str}'. Defaulting to 0."))

                        # Master Update/Create
                        obj, created = Employee.objects.update_or_create(
                            no_nomina=no_nomina,
                            defaults={
                                'nombre': data.get('empleado', ''),
                                'puesto': data.get('puesto', ''),
                                'horario_lv': horario_lv,
                                'horario_s': horario_s,
                                'fecha_ingreso': fecha_ingreso,
                                'vacaciones_historicas_disfrutadas': vacaciones
                            }
                        )
                        
                        if created:
                            created_count += 1
                        else:
                            updated_count += 1

            self.stdout.write(self.style.SUCCESS(
                f"Master ETL completed. Created: {created_count}, Updated: {updated_count}."
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Critical failure in Master ETL: {str(e)}'))
            raise CommandError(e)
