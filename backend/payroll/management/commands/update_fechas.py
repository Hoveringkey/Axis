import csv
from datetime import datetime
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from payroll.models import Employee

class Command(BaseCommand):
    help = 'Imports fecha_ingreso for employees from a CSV file'

    def handle(self, *args, **options):
        csv_file_path = Path('data_fechas.csv')

        if not csv_file_path.is_file():
            self.stdout.write(self.style.ERROR(f'File not found: {csv_file_path}'))
            return

        try:
            parsed_rows = []
            
            with open(csv_file_path, mode='r', encoding='utf-8-sig') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    no_nomina = str(row.get('no_nomina', '')).strip()
                    fecha_str = str(row.get('fecha_antiguedad', '')).strip()
                    
                    if not no_nomina or not fecha_str:
                        continue
                        
                    try:
                        # Parse mm/dd/yyyy date
                        fecha_ingreso = datetime.strptime(fecha_str, '%m/%d/%Y').date()
                        parsed_rows.append({
                            'no_nomina': no_nomina,
                            'fecha_ingreso': fecha_ingreso
                        })
                    except ValueError:
                        self.stdout.write(self.style.WARNING(f"Skipping invalid date for {no_nomina}: {fecha_str}"))

            if not parsed_rows:
                self.stdout.write(self.style.WARNING("No valid rows found to process."))
                return

            with transaction.atomic():
                employees_to_update = []
                # Pre-fetch employees to match in memory
                existing_employees = {e.no_nomina: e for e in Employee.objects.all()}

                for row in parsed_rows:
                    emp = existing_employees.get(row['no_nomina'])
                    if emp:
                        emp.fecha_ingreso = row['fecha_ingreso']
                        employees_to_update.append(emp)

                if employees_to_update:
                    Employee.objects.bulk_update(employees_to_update, ['fecha_ingreso'])
                    self.stdout.write(self.style.SUCCESS(f'Successfully updated {len(employees_to_update)} employees.'))
                else:
                    self.stdout.write(self.style.WARNING("No matching employees found to update."))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {str(e)}'))
