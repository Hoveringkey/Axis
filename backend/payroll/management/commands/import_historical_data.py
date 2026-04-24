import csv
import datetime
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from payroll.models import Employee

class Command(BaseCommand):
    help = 'Import historical seniority dates and vacation data from a CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')

    def handle(self, *args, **options):
        csv_file_path = options['csv_file']
        
        try:
            with open(csv_file_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                # Dynamic check for headers
                headers = reader.fieldnames
                if not headers:
                    raise CommandError("CSV file is empty or has no headers.")
                
                if 'No Nomina' not in headers:
                    raise CommandError("Required header 'No Nomina' missing from CSV.")
                
                updated_count = 0
                
                with transaction.atomic():
                    for row in reader:
                        no_nomina = row.get('No Nomina', '').strip()
                        if not no_nomina:
                            continue
                            
                        try:
                            # Using no_nomina as primary key (as defined in Employee model)
                            employee = Employee.objects.get(no_nomina=no_nomina)
                        except Employee.DoesNotExist:
                            self.stdout.write(self.style.WARNING(f"Employee {no_nomina} not found. Skipping."))
                            continue
                            
                        changed = False
                        
                        # Logic for 'Fecha Antiguedad'
                        if 'Fecha Antiguedad' in row and row['Fecha Antiguedad']:
                            date_val = row['Fecha Antiguedad'].strip()
                            try:
                                # Strict parsing as per requirement
                                employee.fecha_ingreso = datetime.datetime.strptime(date_val, '%m/%d/%Y').date()
                                changed = True
                            except ValueError:
                                self.stdout.write(self.style.ERROR(f"Invalid date format for {no_nomina}: {date_val}. Expected M/D/YYYY."))
                        
                        # Logic for 'Vacaciones Disfrutadas'
                        if 'Vacaciones Disfrutadas' in row and row['Vacaciones Disfrutadas']:
                            vac_val = row['Vacaciones Disfrutadas'].strip()
                            try:
                                employee.vacaciones_historicas_disfrutadas = int(vac_val)
                                changed = True
                            except ValueError:
                                self.stdout.write(self.style.ERROR(f"Invalid vacation count for {no_nomina}: {vac_val}. Expected integer."))
                        
                        if changed:
                            employee.save()
                            updated_count += 1
                
                self.stdout.write(self.style.SUCCESS(f"Successfully processed CSV. Updated {updated_count} employee records."))
                
        except FileNotFoundError:
            raise CommandError(f"File '{csv_file_path}' does not exist.")
        except Exception as e:
            raise CommandError(f"An unexpected error occurred: {str(e)}")
