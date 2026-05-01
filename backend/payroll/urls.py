from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EmployeeViewSet,
    IncidenceCatalogViewSet,
    IncidenceRecordViewSet,
    LoanViewSet,
    ExtraHourBankViewSet,
    PayrollSnapshotViewSet,
    CalculatePayrollView,
    ClosePayrollView,
    PayrollCommitView,
    PayrollPreviewView,
    DashboardMetricsView,
    CurrentWeekView
)

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='EmployeeViewSet')
router.register(r'incidence-catalogs', IncidenceCatalogViewSet)
router.register(r'incidence-records', IncidenceRecordViewSet)
router.register(r'loans', LoanViewSet)
router.register(r'extra-hour-banks', ExtraHourBankViewSet)
router.register(r'snapshots', PayrollSnapshotViewSet, basename='payrollsnapshot')

urlpatterns = [
    path('', include(router.urls)),
    path('preview/', PayrollPreviewView.as_view(), name='payroll_preview'),
    path('commit/', PayrollCommitView.as_view(), name='payroll_commit'),
    path('calculate/', CalculatePayrollView.as_view(), name='calculate_payroll'),
    path('close/', ClosePayrollView.as_view(), name='close_payroll'),
    path('dashboard/', DashboardMetricsView.as_view(), name='dashboard_metrics'),
    path('current-week/', CurrentWeekView.as_view(), name='current_week'),
]
