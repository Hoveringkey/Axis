from django.db import models

class Schedule(models.Model):
    time_range = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.time_range

class Employee(models.Model):
    no_nomina = models.CharField(max_length=50, primary_key=True)
    nombre = models.CharField(max_length=255)
    puesto = models.CharField(max_length=255)
    horario_lv = models.ForeignKey(Schedule, on_delete=models.SET_NULL, null=True, related_name='employees_lv')
    horario_s = models.ForeignKey(Schedule, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees_s')

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

    def __str__(self):
        return f"Loan for {self.empleado.nombre}"

class ExtraHourBank(models.Model):
    empleado = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='extra_hours')
    horas_deuda = models.DecimalField(max_digits=5, decimal_places=2)

    def __str__(self):
        return f"Extra Hours for {self.empleado.nombre}: {self.horas_deuda}"
