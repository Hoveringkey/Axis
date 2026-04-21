from rest_framework import serializers
from .models import Employee, IncidenceCatalog, IncidenceRecord, Loan, ExtraHourBank, Schedule

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

class ExtraHourBankSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtraHourBank
        fields = '__all__'
