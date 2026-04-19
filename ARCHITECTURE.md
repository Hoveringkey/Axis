# HR & Payroll Management System Architecture

## 1. Project Overview
Migration of an existing Excel/VBA HR payroll system to a modern web application. 
- **Backend:** Python with Django and Django REST Framework (DRF). PostgreSQL database.
- **Frontend:** React with TypeScript, using a DataGrid/AG Grid component for Excel-like data visualization.
- **Authentication:** JWT (JSON Web Tokens).

## 2. Business Rules
- **Weekly Bonus (Bono Semanal):** Maximum $126 MXN per week. A deduction of $18 MXN applies for each day an incidence occurs if `AplicaBonoNocturno` is True.
- **Monthly Bonus (Bono Mensual):** Fixed $300 MXN. Forfeited if the employee has any incidence in the previous month where `AplicaBonoMensual` is True.
- **Extra Hours (Horas Extra):** Maximum 9 hours paid per week. Any amount exceeding 9 hours must be automatically sent to the "Hour Bank" (Banco de Horas) to be used in future weeks.
- **Loans (Préstamos):** Weekly loan deductions must be automatically paused (abono = 0) if the employee has "PSG" (Permiso sin Goce de Sueldo) or "I" (Incapacidad) during the week.

## 3. Database Models (Django Models)
### A. Employee (Empleado Base)
- `no_nomina`: CharField (Primary Key, unique identifier)
- `nombre`: CharField
- `puesto`: CharField
- `horario_lv`: CharField (Schedule Monday-Friday)
- `horario_s`: CharField (Schedule Saturday)

### B. Incidence Catalog (Catálogo de Incidencias)
- `tipo`: CharField (e.g., Falta, Vacaciones, Incapacidad)
- `abreviatura`: CharField (e.g., F, V, I)
- `aplica_bono_mensual`: BooleanField
- `aplica_bono_semanal`: BooleanField (maps to AplicaBonoNocturno)
- `aplica_incentivo`: BooleanField

### C. Incidence Record (Registro de Incidencias)
- `fecha`: DateField
- `semana_num`: IntegerField (Calculated from fecha)
- `empleado`: ForeignKey -> Employee
- `tipo_incidencia`: ForeignKey -> Incidence Catalog
- `cantidad`: DecimalField

### D. Loans (Control de Préstamos)
- `empleado`: ForeignKey -> Employee
- `monto_total`: DecimalField
- `abono_semanal`: DecimalField
- `pagos_realizados`: IntegerField

### E. Extra Hour Bank (Banco de Horas Extra)
- `empleado`: ForeignKey -> Employee
- `horas_deuda`: DecimalField