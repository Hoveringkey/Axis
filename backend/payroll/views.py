from django.db import transaction
from rest_framework import viewsets, views, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Employee, IncidenceCatalog, IncidenceRecord, Loan, ExtraHourBank, PayrollSnapshot
from .permissions import (
    IsFinanceAdmin,
    IsPayrollOperator,
    is_finance_admin,
    is_hr_capture,
    is_payroll_operator,
    is_superuser,
)
from .serializers import (
    EmployeeSerializer,
    IncidenceCatalogSerializer,
    IncidenceRecordSerializer,
    LoanSerializer,
    ExtraHourBankSerializer,
    PayrollSnapshotSerializer
)
from .services import (
    PayrollAlreadyClosedError,
    calculate_payroll_for_week,
    commit_payroll_for_week,
    get_dashboard_metrics,
    get_current_payroll_period,
)


def _parse_week_number(raw_week_num):
    if raw_week_num in (None, ''):
        return None, {'error': 'semana_num is required'}

    try:
        week_num = int(raw_week_num)
    except (TypeError, ValueError):
        return None, {'error': 'semana_num must be an integer'}

    if week_num < 1 or week_num > 53:
        return None, {'error': 'semana_num must be between 1 and 53'}

    return week_num, None


def _parse_optional_year(raw_year):
    if raw_year in (None, ''):
        return None, None

    try:
        target_year = int(raw_year)
    except (TypeError, ValueError):
        return None, {'error': 'year must be an integer'}

    if target_year < 1 or target_year > 9999:
        return None, {'error': 'year must be between 1 and 9999'}

    return target_year, None


class CurrentUserView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        groups = list(user.groups.order_by('name').values_list('name', flat=True))

        return Response({
            'username': user.username,
            'is_superuser': user.is_superuser,
            'groups': groups,
            'permissions': {
                'can_access_payroll': is_payroll_operator(user),
                'can_manage_payroll': is_superuser(user) or is_finance_admin(user),
                'can_capture_hr': is_superuser(user) or is_hr_capture(user),
            },
        }, status=status.HTTP_200_OK)


class DashboardMetricsView(views.APIView):
    """Data engine endpoint for the S&OP/HR Dashboard."""
    permission_classes = [IsAuthenticated, IsPayrollOperator]

    def get(self, request):
        metrics = get_dashboard_metrics()
        return Response(metrics, status=status.HTTP_200_OK)

class CurrentWeekView(views.APIView):
    """Utility endpoint to auto-fill the current ISO week."""
    permission_classes = [IsAuthenticated, IsPayrollOperator]

    def get(self, request):
        current_period = get_current_payroll_period()
        current_week = current_period['week']
        return Response({
            'current_week': current_week,
            'current_iso_year': current_period['iso_year'],
            'label': f"{current_period['iso_year']}-S{current_week}",
        }, status=status.HTTP_200_OK)

class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsPayrollOperator]

    def get_queryset(self):
        # Default to only active employees, allow override via query param if needed
        qs = Employee.objects.select_related('horario_lv', 'horario_s').filter(is_active=True)
        return qs

    @action(detail=False, methods=['post'], url_path='alta')
    def alta(self, request):
        """Onboard a new employee."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(is_active=True, vacaciones_historicas_disfrutadas=0)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post', 'patch'], url_path='baja')
    def baja(self, request, pk=None):
        """Offboard an employee (Soft Delete)."""
        try:
            employee = self.get_object()
            fecha_baja = request.data.get('fecha_baja')
            motivo_baja = request.data.get('motivo_baja')
            
            if not fecha_baja:
                return Response({'error': 'fecha_baja is required'}, status=status.HTTP_400_BAD_REQUEST)
                
            employee.is_active = False
            employee.fecha_baja = fecha_baja
            employee.motivo_baja = motivo_baja
            employee.save()
            
            return Response({'status': 'success', 'no_nomina': employee.no_nomina})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
    permission_classes = [IsAuthenticated, IsPayrollOperator]

class IncidenceRecordViewSet(viewsets.ModelViewSet):
    queryset = IncidenceRecord.objects.all()
    serializer_class = IncidenceRecordSerializer
    permission_classes = [IsAuthenticated, IsPayrollOperator]

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
    permission_classes = [IsAuthenticated, IsPayrollOperator]

class ExtraHourBankViewSet(viewsets.ModelViewSet):
    queryset = ExtraHourBank.objects.all()
    serializer_class = ExtraHourBankSerializer
    permission_classes = [IsAuthenticated, IsPayrollOperator]

class PayrollSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit log of permanently closed payroll weeks."""
    serializer_class = PayrollSnapshotSerializer
    permission_classes = [IsAuthenticated, IsPayrollOperator]

    def get_queryset(self):
        qs = PayrollSnapshot.objects.all()
        iso_year = self.request.query_params.get('iso_year')
        if iso_year is not None:
            try:
                qs = qs.filter(iso_year=int(iso_year))
            except ValueError:
                return qs.none()

        semana_num = self.request.query_params.get('semana_num')
        if semana_num is not None:
            try:
                qs = qs.filter(semana_num=int(semana_num))
            except ValueError:
                pass
        return qs

class CalculatePayrollView(views.APIView):
    permission_classes = [IsAuthenticated, IsPayrollOperator]

    # Deprecated legacy endpoint. Use PayrollPreviewView at /api/payroll/preview/.
    def post(self, request):
        week_num, error = _parse_week_number(request.data.get('semana_num'))
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        # Preview action, strict dry_run to prevent state mutation
        results = calculate_payroll_for_week(week_num, dry_run=True)
        return Response({'results': results}, status=status.HTTP_200_OK)

class ClosePayrollView(views.APIView):
    permission_classes = [IsAuthenticated, IsFinanceAdmin]

    # Deprecated legacy endpoint. Use PayrollCommitView at /api/payroll/commit/.
    def post(self, request):
        week_num, error = _parse_week_number(request.data.get('semana_num'))
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        target_year, error = _parse_optional_year(request.data.get('year'))
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        try:
            results = commit_payroll_for_week(week_num, target_year=target_year, user=request.user)
        except PayrollAlreadyClosedError:
            return Response({'error': 'Payroll week is already closed.'}, status=status.HTTP_409_CONFLICT)
        return Response({'results': results}, status=status.HTTP_200_OK)


class PayrollPreviewView(views.APIView):
    permission_classes = [IsAuthenticated, IsPayrollOperator]

    def get(self, request):
        week_num, error = _parse_week_number(request.query_params.get('semana_num'))
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        target_year, error = _parse_optional_year(request.query_params.get('year'))
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        results = calculate_payroll_for_week(week_num, dry_run=True, target_year=target_year)
        return Response({'results': results}, status=status.HTTP_200_OK)


class PayrollCommitView(views.APIView):
    permission_classes = [IsAuthenticated, IsFinanceAdmin]

    def post(self, request):
        week_num, error = _parse_week_number(request.data.get('semana_num'))
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        target_year, error = _parse_optional_year(request.data.get('year'))
        if error:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        try:
            results = commit_payroll_for_week(week_num, target_year=target_year, user=request.user)
        except PayrollAlreadyClosedError:
            return Response({'error': 'Payroll week is already closed.'}, status=status.HTTP_409_CONFLICT)
        return Response({'results': results}, status=status.HTTP_200_OK)
