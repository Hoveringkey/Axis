from django.db import transaction
from rest_framework import viewsets, views, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Employee, IncidenceCatalog, IncidenceRecord, Loan, ExtraHourBank
from .serializers import (
    EmployeeSerializer,
    IncidenceCatalogSerializer,
    IncidenceRecordSerializer,
    LoanSerializer,
    ExtraHourBankSerializer
)
from .services import calculate_payroll_for_week

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related('horario_lv', 'horario_s').all()
    serializer_class = EmployeeSerializer

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        serializer = self.get_serializer(data=request.data, many=True)
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class IncidenceCatalogViewSet(viewsets.ModelViewSet):
    queryset = IncidenceCatalog.objects.all()
    serializer_class = IncidenceCatalogSerializer

class IncidenceRecordViewSet(viewsets.ModelViewSet):
    queryset = IncidenceRecord.objects.all()
    serializer_class = IncidenceRecordSerializer

class LoanViewSet(viewsets.ModelViewSet):
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer

class ExtraHourBankViewSet(viewsets.ModelViewSet):
    queryset = ExtraHourBank.objects.all()
    serializer_class = ExtraHourBankSerializer

class CalculatePayrollView(views.APIView):
    def post(self, request):
        week_num = request.data.get('semana_num')
        if not week_num:
            return Response({'error': 'semana_num is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            week_num = int(week_num)
        except ValueError:
            return Response({'error': 'semana_num must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        # Preview action, strict dry_run to prevent state mutation
        results = calculate_payroll_for_week(week_num, dry_run=True)
        return Response({'results': results}, status=status.HTTP_200_OK)

class ClosePayrollView(views.APIView):
    def post(self, request):
        week_num = request.data.get('semana_num')
        if not week_num:
            return Response({'error': 'semana_num is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            week_num = int(week_num)
        except ValueError:
            return Response({'error': 'semana_num must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        # Commit action, mutates ExtraHourBank and explicitly performs DB writes
        results = calculate_payroll_for_week(week_num, dry_run=False)
        return Response({'results': results}, status=status.HTTP_200_OK)
