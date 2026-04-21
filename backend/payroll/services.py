import datetime
from datetime import timedelta
from decimal import Decimal
from collections import defaultdict
from django.db.models import Sum, Q
from django.db import transaction
from .models import Employee, IncidenceRecord, Loan, ExtraHourBank, IncidenceCatalog

def is_monthly_bonus_week(target_year, target_week_num):
    # Retrieve the exact Friday of the target week (ISO day 5)
    target_friday = datetime.date.fromisocalendar(target_year, target_week_num, 5)
    
    # Retrieve the Friday of the previous week safely using timedelta
    prev_friday = target_friday - datetime.timedelta(weeks=1)
    
    # A bonus week triggers strictly when the boundary Friday lands in a new month
    return target_friday.month != prev_friday.month

def calculate_payable_extra_hours(employee, target_week_num, target_year, week_incidences=None, deferred_saturday_hx=Decimal('0.00'), bank_record=None, dry_run=True):
    target_monday = datetime.date.fromisocalendar(target_year, target_week_num, 1)
    target_sunday = target_monday + timedelta(days=6)
    target_saturday = target_monday + timedelta(days=5)

    # 2. Current Week HX (excluding Saturday)
    current_week_hx = sum(
        (inc.cantidad or Decimal('0.00') for inc in (week_incidences or [])
         if inc.tipo_incidencia.abreviatura == 'HX' and inc.fecha != target_saturday),
        Decimal('0.00')
    )

    # 3. Deferred Saturday HX is now passed in
    
    # 4. Bank Balance
    bank_balance = bank_record.horas_deuda if bank_record else Decimal('0.00')

    # 5. Mathematical limits
    total_hx = current_week_hx + deferred_saturday_hx + bank_balance
    payable_hx = min(total_hx, Decimal('9.00'))
    remnant = total_hx - Decimal('9.00')

    # 6. State Mutation Instructions
    mutation = None
    if not dry_run:
        if remnant > Decimal('0.00'):
            if bank_record:
                mutation = {'action': 'update', 'horas_deuda': remnant, 'record': bank_record}
            else:
                mutation = {'action': 'create', 'horas_deuda': remnant, 'employee': employee}
        else:
            if bank_record:
                mutation = {'action': 'delete', 'record': bank_record}

    return {
        'total_hx': total_hx,
        'payable_hx': payable_hx,
        'bank_deposit': max(Decimal('0.00'), remnant),
        'mutation': mutation
    }

def calculate_payroll_for_week(week_num, dry_run=True):
    # Determine the correct target_year to handle year boundaries
    today_iso = datetime.date.today().isocalendar()
    current_year = today_iso[0]
    current_week = today_iso[1]
    
    if week_num > 50 and current_week < 10:
        target_year = current_year - 1
    elif week_num < 10 and current_week > 50:
        target_year = current_year + 1
    else:
        target_year = current_year

    target_monday = datetime.date.fromisocalendar(target_year, week_num, 1)
    previous_saturday = target_monday - timedelta(days=2)
    lookback_monday = target_monday - timedelta(weeks=4)

    # Trip 1: Employees
    employees = Employee.objects.select_related('horario_lv', 'horario_s').all()
    
    # Trip 2 & 3: Loans & Banks
    loans_dict = {loan.empleado_id: loan for loan in Loan.objects.all()}
    banks_dict = {bank.empleado_id: bank for bank in ExtraHourBank.objects.all()}
    
    # Trip 4: IncidenceCatalog cache
    catalog_cache = {cat.id: cat for cat in IncidenceCatalog.objects.all()}

    # Trip 5: Query A - Current week incidences
    current_week_incidences = IncidenceRecord.objects.filter(
        semana_num=week_num
    ).select_related('tipo_incidencia')
    
    weekly_incidences_map = defaultdict(list)
    for inc in current_week_incidences:
        weekly_incidences_map[inc.empleado_id].append(inc)

    # Trip 6: Query B - Lookback incidences (for monthly bonus AND deferred saturday HX)
    lookback_incidences = IncidenceRecord.objects.filter(
        Q(fecha__gte=lookback_monday, fecha__lt=target_monday, tipo_incidencia__aplica_bono_mensual=True) |
        Q(fecha=previous_saturday, tipo_incidencia__abreviatura='HX')
    ).select_related('tipo_incidencia')
    
    history_map = defaultdict(list)
    deferred_hx_map = defaultdict(Decimal)
    
    for inc in lookback_incidences:
        if inc.tipo_incidencia.aplica_bono_mensual:
            history_map[inc.empleado_id].append(inc)
        if inc.fecha == previous_saturday and inc.tipo_incidencia.abreviatura == 'HX':
            deferred_hx_map[inc.empleado_id] += (inc.cantidad or Decimal('0.00'))

    results = []
    banks_to_create = []
    banks_to_update = []
    banks_to_delete = []

    for employee in employees:
        week_incidences = weekly_incidences_map.get(employee.no_nomina, [])
        
        # 1. Weekly Bonus (Nocturno)
        weekly_bonus = Decimal('0.00')
        weekly_bonus_deduction = Decimal('0.00')
        horario_str = employee.horario_lv.time_range.strip() if employee.horario_lv else ''
        if horario_str == '21:30 - 06:00':
            weekly_bonus = Decimal('126.00')
            weekly_bonus_deduction = Decimal('18.00')
            
        # Deduct $18 per physical absence (excluding bonuses/extra hours)
        physical_absences = sum(
            (inc.cantidad or Decimal('0.00') for inc in week_incidences
            if inc.tipo_incidencia.abreviatura not in ['HX', 'DA']),
            Decimal('0.00')
        )
        final_weekly_bonus = max(Decimal('0.00'), weekly_bonus - (weekly_bonus_deduction * Decimal(str(physical_absences))))

        # 2. Monthly Bonus
        monthly_bonus = Decimal('0.00')
        if is_monthly_bonus_week(target_year, week_num):
            has_bad_incidences = len(history_map.get(employee.no_nomina, [])) > 0
            if not has_bad_incidences:
                monthly_bonus = Decimal('300.00')

        # 3. Abastecedor Incentive (DA)
        da_count = sum((inc.cantidad or Decimal('0.00') for inc in week_incidences if inc.tipo_incidencia.abreviatura == 'DA'), Decimal('0.00'))
        puesto_upper = employee.puesto.strip().upper() if employee.puesto else ''
        horario_upper = employee.horario_lv.time_range.upper() if employee.horario_lv else ''
        
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
        bank_record = banks_dict.get(employee.no_nomina)
        deferred_saturday_hx = deferred_hx_map.get(employee.no_nomina, Decimal('0.00'))
        
        hx_results = calculate_payable_extra_hours(
            employee, 
            week_num, 
            target_year, 
            week_incidences=week_incidences, 
            deferred_saturday_hx=deferred_saturday_hx,
            bank_record=bank_record, 
            dry_run=dry_run
        )
        paid_extra_hours = hx_results['payable_hx']
        
        # Accumulate mutations for ExtraHourBank
        if not dry_run and hx_results.get('mutation'):
            mut = hx_results['mutation']
            if mut['action'] == 'create':
                banks_to_create.append(ExtraHourBank(empleado=mut['employee'], horas_deuda=mut['horas_deuda']))
            elif mut['action'] == 'update':
                rec = mut['record']
                rec.horas_deuda = mut['horas_deuda']
                banks_to_update.append(rec)
            elif mut['action'] == 'delete':
                banks_to_delete.append(mut['record'])

        # 5. Loans
        import math
        loan = loans_dict.get(employee.no_nomina)
        loan_deduction = Decimal('0.00')
        pagos_realizados = 0
        total_pagos = 0

        if loan:
            pagos_realizados = loan.pagos_realizados
            if loan.abono_semanal > 0:
                total_pagos = math.ceil(loan.monto_total / loan.abono_semanal)
                
            has_psg_or_i = any(inc.tipo_incidencia.abreviatura in ['PSG', 'I'] for inc in week_incidences)
            if not has_psg_or_i and loan.pagos_realizados < total_pagos:
                loan_deduction = loan.abono_semanal
                
            # Block IV: PSG Rule
            puesto_upper_psg = employee.puesto.strip().upper() if employee.puesto else ''
            workable_days = 5 if puesto_upper_psg == 'C' else 6
            psg_count = sum((inc.cantidad or Decimal('0.00') for inc in week_incidences if inc.tipo_incidencia.abreviatura == 'PSG'), Decimal('0.00'))
            if psg_count == Decimal(str(workable_days)):
                loan_deduction = Decimal('0.00')

        # 6. Physical Incidences (Ausentismos)
        ausentismos_dict = {}
        for inc in week_incidences:
            abrev = inc.tipo_incidencia.abreviatura
            if abrev not in ['HX', 'DA']: # Exclude extra hours and abastecedor tokens
                ausentismos_dict[abrev] = ausentismos_dict.get(abrev, Decimal('0.00')) + (inc.cantidad or Decimal('0.00'))
        
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

    # Bulk Execute Mutations
    if not dry_run:
        with transaction.atomic():
            if banks_to_create:
                ExtraHourBank.objects.bulk_create(banks_to_create)
            if banks_to_update:
                ExtraHourBank.objects.bulk_update(banks_to_update, ['horas_deuda'])
            if banks_to_delete:
                ExtraHourBank.objects.filter(id__in=[b.id for b in banks_to_delete]).delete()

    return results
