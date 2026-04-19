from django.contrib import admin
from .models import Employee, IncidenceCatalog, IncidenceRecord, Loan, ExtraHourBank

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('no_nomina', 'nombre', 'puesto', 'horario_lv', 'horario_s')
    search_fields = ('no_nomina', 'nombre', 'puesto')

@admin.register(IncidenceCatalog)
class IncidenceCatalogAdmin(admin.ModelAdmin):
    list_display = ('tipo', 'abreviatura', 'aplica_bono_mensual', 'aplica_bono_semanal', 'aplica_incentivo')
    search_fields = ('tipo', 'abreviatura')

@admin.register(IncidenceRecord)
class IncidenceRecordAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'semana_num', 'empleado', 'tipo_incidencia', 'cantidad')
    list_filter = ('fecha', 'semana_num', 'tipo_incidencia')
    search_fields = ('empleado__no_nomina', 'empleado__nombre')

@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ('empleado', 'monto_total', 'abono_semanal', 'pagos_realizados')
    search_fields = ('empleado__no_nomina', 'empleado__nombre')

@admin.register(ExtraHourBank)
class ExtraHourBankAdmin(admin.ModelAdmin):
    list_display = ('empleado', 'horas_deuda')
    search_fields = ('empleado__no_nomina', 'empleado__nombre')
