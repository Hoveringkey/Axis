from rest_framework import serializers
from .models import Employee, IncidenceCatalog, IncidenceRecord, Loan, ExtraHourBank

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'
        extra_kwargs = {
            'horario_s': {'required': False, 'allow_blank': True}
        }

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
