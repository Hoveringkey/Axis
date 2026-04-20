import csv
from django.core.management.base import BaseCommand
from payroll.models import Employee, Schedule
from pathlib import Path

class Command(BaseCommand):
    help = 'Imports employees and schedules from a CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='The path to the CSV file')

    def handle(self, *args, **options):
        csv_file_path = options['csv_file']

        if not Path(csv_file_path).is_file():
            self.stdout.write(self.style.ERROR(f'File not found: {csv_file_path}'))
            return

        try:
            schedules_to_create = set()
            parsed_rows = []

            # Using utf-8-sig to handle optional BOM often added by Excel
            with open(csv_file_path, mode='r', encoding='utf-8-sig') as file:
                reader = csv.DictReader(file)
                
                for row in reader:
                    # Clean the data: drop completely empty rows
                    if not any(str(val).strip() for val in row.values() if val is not None):
                        continue
                        
                    # Clean no_nomina (id)
                    no_nomina = str(row.get('no_nomina', '')).strip()
                    if not no_nomina:
                        continue 
                        
                    nombre = str(row.get('nombre', '')).strip()
                    puesto = str(row.get('puesto', '')).strip()
                    
                    # Handle schedule L-V
                    horario_lv_str = str(row.get('horario_l_v', '')).strip()
                    if not horario_lv_str or horario_lv_str.lower() == 'nan':
                        horario_lv_str = None
                        
                    # Clean data: Handle NaN values in 'horario_s'
                    horario_s_str = str(row.get('horario_s', '')).strip()
                    if not horario_s_str or horario_s_str.lower() == 'nan':
                        horario_s_str = None

                    if horario_lv_str:
                        schedules_to_create.add(horario_lv_str)
                    if horario_s_str:
                        schedules_to_create.add(horario_s_str)
                        
                    parsed_rows.append({
                        'no_nomina': no_nomina,
                        'nombre': nombre,
                        'puesto': puesto,
                        'horario_lv': horario_lv_str,
                        'horario_s': horario_s_str,
                    })

            # Handle foreign key relationships logically: 
            # create the Schedules first if they don't exist
            existing_schedules = set(Schedule.objects.values_list('time_range', flat=True))
            new_schedules = schedules_to_create - existing_schedules
            
            if new_schedules:
                # Use bulk_create for optimal performance
                Schedule.objects.bulk_create([Schedule(time_range=s) for s in new_schedules])
                self.stdout.write(self.style.SUCCESS(f'Successfully created {len(new_schedules)} new schedules.'))
            else:
                self.stdout.write(self.style.SUCCESS('No new schedules to create.'))
            
            # Fetch all schedules into a dictionary for fast lookup
            schedule_map = {s.time_range: s for s in Schedule.objects.all()}
            
            # Prepare employees for bulk_create or update
            employees_to_create = []
            employees_to_update = []
            
            existing_employees = {e.no_nomina: e for e in Employee.objects.all()}
            
            for row in parsed_rows:
                # Assign the newly created Schedule objects
                horario_lv = schedule_map.get(row['horario_lv']) if row['horario_lv'] else None
                horario_s = schedule_map.get(row['horario_s']) if row['horario_s'] else None
                
                if row['no_nomina'] in existing_employees:
                    emp = existing_employees[row['no_nomina']]
                    emp.nombre = row['nombre']
                    emp.puesto = row['puesto']
                    emp.horario_lv = horario_lv
                    emp.horario_s = horario_s
                    employees_to_update.append(emp)
                else:
                    employees_to_create.append(Employee(
                        no_nomina=row['no_nomina'],
                        nombre=row['nombre'],
                        puesto=row['puesto'],
                        horario_lv=horario_lv,
                        horario_s=horario_s
                    ))
            
            # Use bulk_create for optimal database transaction performance
            if employees_to_create:
                Employee.objects.bulk_create(employees_to_create)
                self.stdout.write(self.style.SUCCESS(f'Successfully created {len(employees_to_create)} employees.'))
                
            if employees_to_update:
                Employee.objects.bulk_update(employees_to_update, ['nombre', 'puesto', 'horario_lv', 'horario_s'])
                self.stdout.write(self.style.SUCCESS(f'Successfully updated {len(employees_to_update)} employees.'))

            self.stdout.write(self.style.SUCCESS('Import process completed successfully.'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {str(e)}'))
