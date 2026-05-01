from django.db import models

class Schedule(models.Model):
    time_range = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.time_range

class Employee(models.Model):
    no_nomina = models.CharField(max_length=50, primary_key=True)
    nombre = models.CharField(max_length=255)
    puesto = models.CharField(max_length=255)
    fecha_ingreso = models.DateField(null=True)
    is_active = models.BooleanField(default=True)
    fecha_baja = models.DateField(null=True, blank=True)
    motivo_baja = models.TextField(null=True, blank=True)
    horario_lv = models.ForeignKey(Schedule, on_delete=models.SET_NULL, null=True, related_name='employees_lv')
    horario_s = models.ForeignKey(Schedule, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees_s')
    vacaciones_historicas_disfrutadas = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.no_nomina} - {self.nombre}"

class IncidenceCatalog(models.Model):
    tipo = models.CharField(max_length=100)
    abreviatura = models.CharField(max_length=10)
    aplica_bono_mensual = models.BooleanField(default=False)
    aplica_bono_semanal = models.BooleanField(default=False)
    aplica_incentivo = models.BooleanField(default=False)

    def __str__(self):
        return self.tipo

class IncidenceRecord(models.Model):
    fecha = models.DateField()
    semana_num = models.IntegerField()
    empleado = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='incidences')
    tipo_incidencia = models.ForeignKey(IncidenceCatalog, on_delete=models.CASCADE)
    cantidad = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        unique_together = ('empleado', 'fecha', 'tipo_incidencia')

    def __str__(self):
        return f"{self.empleado.no_nomina} - {self.tipo_incidencia.abreviatura} ({self.fecha})"

class Loan(models.Model):
    empleado = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='loans')
    monto_total = models.DecimalField(max_digits=10, decimal_places=2)
    abono_semanal = models.DecimalField(max_digits=10, decimal_places=2)
    pagos_realizados = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, default='PENDIENTE', choices=[
        ('PENDIENTE', 'Pendiente'),
        ('PAGADO', 'Pagado'),
        ('CANCELADO', 'Cancelado')
    ])

    def __str__(self):
        return f"Loan for {self.empleado.nombre}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['empleado'],
                condition=models.Q(is_active=True),
                name='unique_active_loan_per_employee',
            ),
        ]

class ExtraHourBank(models.Model):
    empleado = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='extra_hours')
    horas_deuda = models.DecimalField(max_digits=5, decimal_places=2)

    def __str__(self):
        return f"Extra Hours for {self.empleado.nombre}: {self.horas_deuda}"

class PayrollSnapshot(models.Model):
    """Immutable audit record written once when a payroll week is permanently closed."""
    semana_num = models.IntegerField(db_index=True)
    fecha_cierre = models.DateTimeField(auto_now_add=True)
    empleado_no_nomina = models.CharField(max_length=50)
    empleado_nombre = models.CharField(max_length=255)
    total_pagar = models.DecimalField(max_digits=10, decimal_places=2)
    desglose = models.JSONField()  # Full calculation dict for this employee

    class Meta:
        ordering = ['-fecha_cierre']

    def __str__(self):
        return f"Snapshot S{self.semana_num} – {self.empleado_no_nomina}"
