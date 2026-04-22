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
    ClosePayrollView
)

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)
router.register(r'incidence-catalogs', IncidenceCatalogViewSet)
router.register(r'incidence-records', IncidenceRecordViewSet)
router.register(r'loans', LoanViewSet)
router.register(r'extra-hour-banks', ExtraHourBankViewSet)
router.register(r'snapshots', PayrollSnapshotViewSet, basename='payrollsnapshot')

urlpatterns = [
    path('', include(router.urls)),
    path('calculate/', CalculatePayrollView.as_view(), name='calculate_payroll'),
    path('close/', ClosePayrollView.as_view(), name='close_payroll'),
]
