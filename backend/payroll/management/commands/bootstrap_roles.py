from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from payroll.permissions import FINANCE_ADMIN, HR_CAPTURE


class Command(BaseCommand):
    help = 'Create required production-safe RBAC groups.'

    def handle(self, *args, **options):
        created = []
        existing = []

        for group_name in (HR_CAPTURE, FINANCE_ADMIN):
            _, was_created = Group.objects.get_or_create(name=group_name)
            if was_created:
                created.append(group_name)
            else:
                existing.append(group_name)

        self.stdout.write(
            self.style.SUCCESS(
                'bootstrap_roles complete: '
                f'created={len(created)} [{", ".join(created) or "none"}]; '
                f'existing={len(existing)} [{", ".join(existing) or "none"}]'
            )
        )
