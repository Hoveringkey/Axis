import datetime
from datetime import timedelta
from decimal import Decimal
from collections import defaultdict
from django.db.models import Sum, Q
from django.db import transaction
from .models import Employee, IncidenceRecord, Loan, ExtraHourBank, IncidenceCatalog, PayrollSnapshot

def get_current_payroll_week():
    """Returns the current ISO-8601 week number."""
    return datetime.date.today().isocalendar()[1]

def get_dashboard_metrics() -> dict:
    """
    Dashboard Data Engine: Aggregates scalars, LFT alerts, and graph data 
    for the S&OP/HR Dashboard.
    """
    today = datetime.date.today()
    current_week = get_current_payroll_week()
    
    # Calculate previous week with year-boundary awareness
    prev_date = today - timedelta(weeks=1)
    prev_week = prev_date.isocalendar()[1]
    
    # --- Scalars ---
    active_employees = Employee.objects.filter(is_active=True)
    active_count = active_employees.count()
    turno_a_count = active_employees.filter(puesto='A').count()
    turno_c_count = active_employees.filter(puesto='C').count()
    
    incidencias_semana_actual = IncidenceRecord.objects.filter(semana_num=current_week).count()
    incidencias_semana_pasada = IncidenceRecord.objects.filter(semana_num=prev_week).count()
    
    # --- Radar LFT: proximos_aniversarios ---
    limit_15_days = today + timedelta(days=15)
    proximos_aniversarios = []
    
    for emp in active_employees.filter(fecha_ingreso__isnull=False):
        # Calculate anniversary this year
        anniv = safe_replace_year(emp.fecha_ingreso, today.year)
        # If it already happened this year, check next year (e.g., Dec to Jan transition)
        if anniv < today:
            anniv = safe_replace_year(emp.fecha_ingreso, today.year + 1)
            
        if today <= anniv <= limit_15_days:
            proximos_aniversarios.append({
                "name": emp.nombre,
                "years_reached": anniv.year - emp.fecha_ingreso.year,
                "exact_date": anniv.strftime('%d/%b/%Y')
            })

    # --- Graph 1: tendencia_horas_extras (Last 4 ISO weeks) ---
    tendencia_horas_extras = []
    for i in range(3, -1, -1):
        target_date = today - timedelta(weeks=i)
        w_year, w_num, _ = target_date.isocalendar()
        total_hx = IncidenceRecord.objects.filter(
            semana_num=w_num,
            tipo_incidencia__abreviatura='HX'
        ).aggregate(total=Sum('cantidad'))['total'] or Decimal('0.00')
        tendencia_horas_extras.append({'semana': w_num, 'horas': float(total_hx)})

    # --- Graph 2: ausentismo_por_turno ---
    # We define negative incidences as 'F' (Falta) or 'PSG' (Permiso sin Goce)
    neg_abrevs = ['F', 'PSG']
    
    def get_neg_count(week_num, puesto_filter):
        return IncidenceRecord.objects.filter(
            semana_num=week_num,
            empleado__puesto=puesto_filter,
            tipo_incidencia__abreviatura__in=neg_abrevs
        ).count()
    
    ausentismo_por_turno = {
        'actual': {
            'A': get_neg_count(current_week, 'A'),
            'C': get_neg_count(current_week, 'C')
        },
        'pasada': {
            'A': get_neg_count(prev_week, 'A'),
            'C': get_neg_count(prev_week, 'C')
        }
    }

    # --- Graph 3: pasivo_vacacional_por_puesto ---
    pasivo_map = defaultdict(float)
    for emp in active_employees:
        balance_data = calculate_vacation_balance(emp)
        pasivo_map[emp.puesto] += balance_data['dias_restantes']
    
    pasivo_vacacional_por_puesto = [
        {'puesto': p, 'dias_adeudados': d} 
        for p, d in pasivo_map.items()
    ]

    return {
        "scalars": {
            "active_employees_count": active_count,
            "turno_a_count": turno_a_count,
            "turno_c_count": turno_c_count,
            "incidencias_semana_actual": incidencias_semana_actual,
            "incidencias_semana_pasada": incidencias_semana_pasada,
        },
        "radar_lft": {
            "proximos_aniversarios": proximos_aniversarios
        },
        "graph_overtime": tendencia_horas_extras,
        "graph_absenteeism": ausentismo_por_turno,
        "graph_vacation_liability": pasivo_vacacional_por_puesto
    }

def get_lft_days_for_year(year: int) -> int:
    """
    Helper logic to determine LFT vacation days based on seniority year.
    Year 1: 12, 2: 14, 3: 16, 4: 18, 5: 20, 6-10: 22, 11-15: 24, 16-20: 26, etc.
    """
    if year <= 0:
        return 0
    if year <= 5:
        return 10 + (year * 2)
    # After 5 years, it increases by 2 days every 5 years
    cycles = (year - 6) // 5 + 1
    return 20 + (cycles * 2)

def get_historical_lft_days(year: int, anniversary_date: datetime.date) -> int:
    """
    Calculates LFT days based on the anniversary date and seniority year.
    Supports transitional logic for LFT 2023.
    """
    if year <= 0:
        return 0
    
    cutoff_2023 = datetime.date(2023, 1, 1)
    
    if anniversary_date < cutoff_2023:
        # Pre-2023 rules: Year 1: 6, Year 2: 8, Year 3: 10, Year 4: 12, Years 5-9: 14, etc.
        if year <= 4:
            return 4 + (year * 2)
        cycles = (year - 5) // 5 + 1
        return 12 + (cycles * 2)
    else:
        # 2023 rules: Year 1: 12, Year 2: 14, Year 3: 16, Year 4: 18, Year 5: 20, Years 6-10: 22, etc.
        if year <= 5:
            return 10 + (year * 2)
        cycles = (year - 6) // 5 + 1
        return 20 + (cycles * 2)

def safe_replace_year(date_obj, year):
    """Safely replace the year of a date, handling February 29 leap year cases."""
    try:
        return date_obj.replace(year=year)
    except ValueError:
        # Handle Feb 29 on non-leap years by falling back to Feb 28
        return date_obj.replace(year=year, day=28)

def calculate_vacation_balance(employee) -> dict:
    """
    Refactored vacation engine: 'Annualized Model with Debt Carryover'.
    Strict Expiration for positive balances to comply with LFT 2023.
    """
    if not employee.fecha_ingreso:
        return {
            "employee": employee.nombre,
            "antigüedad_años": 0,
            "periodo": "N/A",
            "dias_con_derecho": 0,
            "dias_disfrutados": 0,
            "dias_restantes": 0
        }

    today = datetime.date.today()
    ingreso = employee.fecha_ingreso
    
    # 1. Date & Seniority
    antigüedad_años = today.year - ingreso.year
    if (today.month, today.day) < (ingreso.month, ingreso.day):
        antigüedad_años -= 1
    
    if antigüedad_años < 0:
        antigüedad_años = 0

    # Current Anniversary Window (period_start and period_end)
    period_start = safe_replace_year(ingreso, ingreso.year + antigüedad_años)
    period_end = safe_replace_year(ingreso, ingreso.year + antigüedad_años + 1)
    
    # 2. Historical LFT Calculation
    # Calculate total_historico_ganado by summing LFT days for every completed year (1 to antigüedad_años)
    total_historico_ganado = 0
    for y in range(1, antigüedad_años + 1):
        anniv_date = safe_replace_year(ingreso, ingreso.year + y)
        total_historico_ganado += get_historical_lft_days(y, anniv_date)
    
    # 3. The 'Corte de Caja' (Snapshot & Rule)
    balance_historico = total_historico_ganado - employee.vacaciones_historicas_disfrutadas
    
    # Apply Rule Option 1 (Strict Expiration): Debt carries over, positive balance expires.
    deuda_arrastre = balance_historico if balance_historico < 0 else 0
    
    # 4. Current Year Rights
    # Determine dias_lft_actual based on current year of service (antigüedad_años + 1)
    anniv_actual = safe_replace_year(ingreso, ingreso.year + antigüedad_años + 1)
    dias_lft_actual = get_historical_lft_days(antigüedad_años + 1, anniv_actual)
    
    # Fix the New Hire Rule: If antigüedad_años == 0, dias_lft_actual must strictly be 0.
    if antigüedad_años == 0:
        dias_lft_actual = 0
        
    dias_con_derecho_neto = dias_lft_actual + deuda_arrastre
    
    # 5. Current Period Consumption
    # Query IncidenceRecord for 'V' or 'VACACIONES' within the current anniversary window
    vacaciones_tomadas_periodo = IncidenceRecord.objects.filter(
        empleado=employee,
        tipo_incidencia__abreviatura__in=['V', 'VACACIONES'],
        fecha__gte=period_start,
        fecha__lt=period_end
    ).aggregate(total=Sum('cantidad'))['total'] or Decimal('0.00')
    
    vacaciones_tomadas_periodo = float(vacaciones_tomadas_periodo)
    
    # 6. Final Computation & Return Contract
    dias_restantes = float(dias_con_derecho_neto) - vacaciones_tomadas_periodo
    
    return {
        "employee": employee.nombre,
        "antigüedad_años": antigüedad_años,
        "periodo": f"{period_start.strftime('%d/%b/%Y')} - {period_end.strftime('%d/%b/%Y')}",
        "dias_con_derecho": float(dias_con_derecho_neto),
        "dias_disfrutados": vacaciones_tomadas_periodo,
        "dias_restantes": float(dias_restantes)
    }

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
            
        # Deduct $18 per physical absence (excluding bonuses/extra hours AND Vacations)
        physical_absences = sum(
            (inc.cantidad or Decimal('0.00') for inc in week_incidences
            if inc.tipo_incidencia.abreviatura not in ['HX', 'DA', 'V', 'VACACIONES']),
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
            import math
            total_pagos = math.ceil(loan.monto_total / loan.abono_semanal) if loan.abono_semanal > 0 else 0
            has_psg_or_i = any(inc.tipo_incidencia.abreviatura in ['PSG', 'I'] for inc in week_incidences)
            if not has_psg_or_i and loan.pagos_realizados < total_pagos and loan.is_active:
                loan_deduction = loan.abono_semanal
                
            # Block IV: PSG Rule
            puesto_upper_psg = employee.puesto.strip().upper() if employee.puesto else ''
            workable_days = 5 if puesto_upper_psg == 'C' else 6
            psg_count = sum((inc.cantidad or Decimal('0.00') for inc in week_incidences if inc.tipo_incidencia.abreviatura == 'PSG'), Decimal('0.00'))
            if psg_count == Decimal(str(workable_days)):
                loan_deduction = Decimal('0.00')

        # 6. Physical Incidences (Ausentismos) — date-injected format
        ausentismos_dates: dict[str, list[str]] = {}
        for inc in week_incidences:
            abrev = inc.tipo_incidencia.abreviatura
            if abrev not in ['HX', 'DA']:
                date_str = inc.fecha.strftime('%Y-%m-%d')
                if abrev not in ausentismos_dates:
                    ausentismos_dates[abrev] = []
                if date_str not in ausentismos_dates[abrev]:
                    ausentismos_dates[abrev].append(date_str)

        ausentismos_parts = []
        for abrev, dates in ausentismos_dates.items():
            dates.sort()
            ausentismos_parts.append(f"{abrev}:{('|').join(dates)}")
        ausentismos_str = ", ".join(ausentismos_parts)

        # 7. Filter: Only append if there are ANY variations
        has_variations = (
            len(ausentismos_dates) > 0 or
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

            # Build immutable audit snapshots
            snapshots = []
            for row in results:
                bonos = row.get('bonos', {})
                total_bonos = Decimal(str(sum(v for v in bonos.values() if v > 0)))
                total_pagar = (
                    total_bonos
                    + Decimal(str(row.get('paid_extra_hours', 0)))
                    - Decimal(str(row.get('loan_deduction', 0)))
                )
                snapshots.append(PayrollSnapshot(
                    semana_num=week_num,
                    empleado_no_nomina=row['no_nomina'],
                    empleado_nombre=row['nombre'],
                    total_pagar=total_pagar.quantize(Decimal('0.01')),
                    desglose=row,
                ))
            if snapshots:
                PayrollSnapshot.objects.bulk_create(snapshots)

            # --- Sprint 6: Transactional Loan Tracker ---
            # Update loans for all employees who had a deduction this week
            loan_ids_to_increment = [
                loans_dict[row['no_nomina']].id 
                for row in results if row.get('loan_deduction', 0) > 0
            ]
            
            if loan_ids_to_increment:
                from django.db.models import F
                # Increment pagos_realizados
                Loan.objects.filter(id__in=loan_ids_to_increment).update(pagos_realizados=F('pagos_realizados') + 1)
                
                # Check for completed loans (using math.ceil to match calculation logic)
                for l_id in loan_ids_to_increment:
                    loan_obj = Loan.objects.get(id=l_id)
                    import math
                    limit = math.ceil(loan_obj.monto_total / loan_obj.abono_semanal) if loan_obj.abono_semanal > 0 else 0
                    if loan_obj.pagos_realizados >= limit:
                        loan_obj.is_active = False
                        loan_obj.status = 'PAGADO'
                        loan_obj.save()

    return results
