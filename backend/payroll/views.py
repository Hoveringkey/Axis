from django.db import transaction
from rest_framework import viewsets, views, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Employee, IncidenceCatalog, IncidenceRecord, Loan, ExtraHourBank, PayrollSnapshot
from .serializers import (
    EmployeeSerializer,
    IncidenceCatalogSerializer,
    IncidenceRecordSerializer,
    LoanSerializer,
    ExtraHourBankSerializer,
    PayrollSnapshotSerializer
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

    @action(detail=False, methods=['post'], url_path='swap_shifts')
    def swap_shifts(self, request):
        no_nomina_1 = request.data.get('no_nomina_1')
        no_nomina_2 = request.data.get('no_nomina_2')
        
        if not no_nomina_1 or not no_nomina_2:
            return Response({'error': 'no_nomina_1 and no_nomina_2 are required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                emp1 = Employee.objects.select_for_update().get(no_nomina=no_nomina_1)
                emp2 = Employee.objects.select_for_update().get(no_nomina=no_nomina_2)
                
                temp_lv = emp1.horario_lv
                emp1.horario_lv = emp2.horario_lv
                emp2.horario_lv = temp_lv
                
                temp_s = emp1.horario_s
                emp1.horario_s = emp2.horario_s
                emp2.horario_s = temp_s
                
                emp1.save()
                emp2.save()
            return Response({'status': 'success'})
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='vacation_status')
    def vacation_status(self, request, pk=None):
        try:
            employee = self.get_object()
            from .services import calculate_vacation_balance
            data = calculate_vacation_balance(employee)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class IncidenceCatalogViewSet(viewsets.ModelViewSet):
    queryset = IncidenceCatalog.objects.all()
    serializer_class = IncidenceCatalogSerializer

class IncidenceRecordViewSet(viewsets.ModelViewSet):
    queryset = IncidenceRecord.objects.all()
    serializer_class = IncidenceRecordSerializer

    @action(detail=False, methods=['post'], url_path='bulk_asueto')
    def bulk_asueto(self, request):
        fecha_str = request.data.get('fecha')
        if not fecha_str:
            return Response({'error': 'fecha is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        import datetime
        from decimal import Decimal
        try:
            fecha = datetime.date.fromisoformat(fecha_str)
            semana_num = fecha.isocalendar()[1]
        except ValueError:
            return Response({'error': 'Invalid fecha format, should be YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            catalog = IncidenceCatalog.objects.get(abreviatura='ASU')
        except IncidenceCatalog.DoesNotExist:
            return Response({'error': 'Asueto catalog (ASU) not found'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            active_employees = Employee.objects.filter(is_active=True)
            
            employees_with_incidence = IncidenceRecord.objects.filter(
                fecha=fecha,
                empleado__in=active_employees
            ).values_list('empleado_id', flat=True)
            
            eligible_employees = active_employees.exclude(no_nomina__in=employees_with_incidence)
            
            records_to_create = [
                IncidenceRecord(
                    fecha=fecha,
                    semana_num=semana_num,
                    empleado=emp,
                    tipo_incidencia=catalog,
                    cantidad=Decimal('1.00')
                ) for emp in eligible_employees
            ]
            
            if records_to_create:
                IncidenceRecord.objects.bulk_create(records_to_create)
                
        return Response({
            'status': 'success', 
            'created_count': len(records_to_create)
        }, status=status.HTTP_201_CREATED)

class LoanViewSet(viewsets.ModelViewSet):
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer

class ExtraHourBankViewSet(viewsets.ModelViewSet):
    queryset = ExtraHourBank.objects.all()
    serializer_class = ExtraHourBankSerializer

class PayrollSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit log of permanently closed payroll weeks."""
    serializer_class = PayrollSnapshotSerializer

    def get_queryset(self):
        qs = PayrollSnapshot.objects.all()
        semana_num = self.request.query_params.get('semana_num')
        if semana_num is not None:
            try:
                qs = qs.filter(semana_num=int(semana_num))
            except ValueError:
                pass
        return qs

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
