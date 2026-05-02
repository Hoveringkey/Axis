from rest_framework import serializers
from .models import Employee, IncidenceCatalog, IncidenceRecord, Loan, ExtraHourBank, Schedule, PayrollClosure, PayrollSnapshot

class EmployeeSerializer(serializers.ModelSerializer):
    horario_lv = serializers.SlugRelatedField(
        slug_field='time_range',
        queryset=Schedule.objects.all(),
        allow_null=True,
        required=False
    )
    horario_s = serializers.SlugRelatedField(
        slug_field='time_range',
        queryset=Schedule.objects.all(),
        allow_null=True,
        required=False
    )

    class Meta:
        model = Employee
        fields = '__all__'

class IncidenceCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidenceCatalog
        fields = '__all__'

class IncidenceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidenceRecord
        fields = '__all__'

class LoanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = '__all__'

    def validate(self, attrs):
        empleado = attrs.get('empleado', getattr(self.instance, 'empleado', None))
        is_active = attrs.get('is_active', getattr(self.instance, 'is_active', True))

        if empleado and is_active:
            active_loans = Loan.objects.filter(empleado=empleado, is_active=True)
            if self.instance:
                active_loans = active_loans.exclude(pk=self.instance.pk)
            if active_loans.exists():
                raise serializers.ValidationError({
                    'empleado': 'Employee already has an active loan.'
                })

        return attrs

class ExtraHourBankSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtraHourBank
        fields = '__all__'

class PayrollClosureSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollClosure
        fields = '__all__'
        read_only_fields = ['closed_at']

class PayrollSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollSnapshot
        fields = ['id', 'iso_year', 'semana_num', 'closure', 'fecha_cierre', 'empleado_no_nomina', 'empleado_nombre', 'total_pagar', 'desglose']
        read_only_fields = ['iso_year', 'closure']
