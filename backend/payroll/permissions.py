from rest_framework.permissions import BasePermission


HR_CAPTURE = "HR_CAPTURE"
FINANCE_ADMIN = "FINANCE_ADMIN"


def is_hr_capture(user):
    return bool(
        user
        and user.is_authenticated
        and user.groups.filter(name=HR_CAPTURE).exists()
    )


def is_finance_admin(user):
    return bool(
        user
        and user.is_authenticated
        and user.groups.filter(name=FINANCE_ADMIN).exists()
    )


def is_superuser(user):
    return bool(user and user.is_authenticated and user.is_superuser)


def is_payroll_operator(user):
    return is_superuser(user) or is_hr_capture(user) or is_finance_admin(user)


class IsPayrollOperator(BasePermission):
    def has_permission(self, request, view):
        return is_payroll_operator(request.user)


class IsFinanceAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_superuser(request.user) or is_finance_admin(request.user)
