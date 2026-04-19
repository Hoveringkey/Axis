import datetime
from datetime import timedelta
from decimal import Decimal
from django.db.models import Sum
from .models import Employee, IncidenceRecord, Loan, ExtraHourBank

def calculate_payable_extra_hours(employee, target_week_num, target_year):
    target_monday = datetime.date.fromisocalendar(target_year, target_week_num, 1)
    target_sunday = target_monday + timedelta(days=6)
    target_saturday = target_monday + timedelta(days=5)
    previous_saturday = target_monday - timedelta(days=2)

    # 2. Current Week HX (excluding Saturday)
    current_week_hx = IncidenceRecord.objects.filter(
        empleado=employee,
        fecha__gte=target_monday,
        fecha__lte=target_sunday,
        tipo_incidencia__abreviatura='HX'
    ).exclude(fecha=target_saturday).aggregate(total=Sum('cantidad'))['total'] or Decimal('0.00')

    # 3. Deferred Saturday HX
    deferred_saturday_hx = IncidenceRecord.objects.filter(
        empleado=employee,
        fecha=previous_saturday,
        tipo_incidencia__abreviatura='HX'
    ).aggregate(total=Sum('cantidad'))['total'] or Decimal('0.00')

    # 4. Bank Balance
    bank_record = ExtraHourBank.objects.filter(empleado=employee).first()
    bank_balance = bank_record.horas_deuda if bank_record else Decimal('0.00')

    # 5. Mathematical limits
    total_hx = current_week_hx + deferred_saturday_hx + bank_balance
    payable_hx = min(total_hx, Decimal('9.00'))
    remnant = total_hx - Decimal('9.00')

    # 6. State Mutation
    if remnant > Decimal('0.00'):
        if bank_record:
            bank_record.horas_deuda = remnant
            bank_record.save()
        else:
            ExtraHourBank.objects.create(empleado=employee, horas_deuda=remnant)
    else:
        if bank_record:
            bank_record.delete()

    return {
        'total_hx': total_hx,
        'payable_hx': payable_hx,
        'bank_deposit': max(Decimal('0.00'), remnant)
    }

def calculate_payroll_for_week(week_num):
    employees = Employee.objects.all()
    results = []

    for employee in employees:
        week_incidences = IncidenceRecord.objects.filter(empleado=employee, semana_num=week_num)
        
        # 1. Weekly Bonus (Nocturno)
        weekly_bonus = Decimal('0.00')
        weekly_bonus_deduction = Decimal('0.00')
        if employee.horario_lv.strip() == '21:30 - 06:00':
            weekly_bonus = Decimal('126.00')
            weekly_bonus_deduction = Decimal('18.00')
            
        # Deduct $18 per physical absence (excluding bonuses/extra hours)
        physical_absences = sum(
            inc.cantidad for inc in week_incidences 
            if inc.tipo_incidencia.abreviatura not in ['HX', 'DA']
        )
        final_weekly_bonus = max(Decimal('0.00'), weekly_bonus - (weekly_bonus_deduction * Decimal(str(physical_absences))))

        # 2. Monthly Bonus
        past_month_incidences = IncidenceRecord.objects.filter(
            empleado=employee, 
            semana_num__gte=week_num-4,
            semana_num__lt=week_num,
            tipo_incidencia__aplica_bono_mensual=True
        ).exists()
        monthly_bonus = Decimal('0.00') if past_month_incidences else Decimal('300.00')

        # 3. Abastecedor Incentive (DA)
        da_count = week_incidences.filter(tipo_incidencia__abreviatura='DA').aggregate(total=Sum('cantidad'))['total'] or Decimal('0.00')
        puesto_upper = employee.puesto.upper()
        horario_upper = employee.horario_lv.upper()
        
        target_da = Decimal('6.00')
        if 'C' in puesto_upper or 'NOCHE' in horario_upper or '22:00' in horario_upper:
            target_da = Decimal('5.00')
        
        abastecedor_bonus = Decimal('0.00')
        if da_count > 0:
            ratio = min(da_count / target_da, Decimal('1.00'))
            abastecedor_bonus = ratio * Decimal('350.00')
            abastecedor_bonus = abastecedor_bonus.quantize(Decimal('0.01'))

        bonos = {
            'Nocturno': float(final_weekly_bonus),
            'Mensual': float(monthly_bonus),
            'Abastecedor': float(abastecedor_bonus)
        }

        # 4. Extra Hours
        target_year = datetime.date.today().year
        hx_results = calculate_payable_extra_hours(employee, week_num, target_year)
        paid_extra_hours = hx_results['payable_hx']

        # 5. Loans
        import math
        loan = Loan.objects.filter(empleado=employee).first()
        loan_deduction = Decimal('0.00')
        pagos_realizados = 0
        total_pagos = 0

        if loan:
            pagos_realizados = loan.pagos_realizados
            if loan.abono_semanal > 0:
                total_pagos = math.ceil(loan.monto_total / loan.abono_semanal)
                
            has_psg_or_i = week_incidences.filter(tipo_incidencia__abreviatura__in=['PSG', 'I']).exists()
            if not has_psg_or_i and loan.pagos_realizados < total_pagos:
                loan_deduction = loan.abono_semanal
                
            # Block IV: PSG Rule
            workable_days = 5 if employee.puesto.strip().upper() == 'C' else 6
            psg_count = week_incidences.filter(tipo_incidencia__abreviatura='PSG').aggregate(total=Sum('cantidad'))['total'] or Decimal('0.00')
            if psg_count == Decimal(str(workable_days)):
                loan_deduction = Decimal('0.00')

        # 6. Physical Incidences (Ausentismos)
        ausentismos_dict = {}
        for inc in week_incidences:
            abrev = inc.tipo_incidencia.abreviatura
            if abrev not in ['HX', 'DA']: # Exclude extra hours and abastecedor tokens
                ausentismos_dict[abrev] = ausentismos_dict.get(abrev, Decimal('0.00')) + inc.cantidad
        
        ausentismos_parts = []
        for k, v in ausentismos_dict.items():
            val_str = str(int(v)) if v == v.to_integral_value() else str(v)
            ausentismos_parts.append(f"{k}: {val_str}")
        ausentismos_str = ", ".join(ausentismos_parts)

        # 7. Filter: Only append if there are ANY variations
        has_variations = (
            len(ausentismos_dict) > 0 or
            paid_extra_hours > 0 or
            final_weekly_bonus > 0 or
            monthly_bonus > 0 or
            abastecedor_bonus > 0 or
            loan_deduction > 0
        )

        if has_variations:
            results.append({
                'no_nomina': employee.no_nomina,
                'nombre': employee.nombre,
                'ausentismos': ausentismos_str,
                'paid_extra_hours': float(paid_extra_hours),
                'bonos': bonos,
                'loan_deduction': float(loan_deduction),
                'pagos_realizados': pagos_realizados,
                'total_pagos': total_pagos
            })

    return results
