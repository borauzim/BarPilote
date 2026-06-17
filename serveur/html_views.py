from django.views.generic import TemplateView, DetailView
from django.views import View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Q, Count, Sum, F
from django.contrib import messages
from django.contrib.auth import logout
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
import uuid

from proprietaire.models import PilotProfile, StockItem, Order, OrderItem, Table, Bar, Category, Perte, Facture, Client
from proprietaire.order_services import take_order_for_profile
from proprietaire.notifications import notify_bar_owners, notify_debt_created, notify_order_created, notify_order_status, notify_user
from serveur.models import ServeurProfile, Shift
from client.models import ClientOrderMeta
from serveur.invitations import InvitationError, attach_user_to_bar


def _expects_json(request):
    accept = request.headers.get('Accept', '')
    return request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in accept


def _live_payload(request, payload, status=200):
    if _expects_json(request):
        return JsonResponse(payload, status=status)
    return None


def _server_base_context(profile, pilot_profile=None):
    bar = profile.bar
    # L'interface serveur travaille toujours en dollars.
    pref_currency = 'USD'

    return {
        'profile': profile,
        'pilot_profile': pilot_profile,
        'bar': bar,
        'base_template': 'serveur/base_serveur.html',
        'is_server_interface': True,
        'read_only_interface': True,
        'pref_currency': pref_currency,
        'exchange_rate': bar.taux_change_usd_to_cdf if bar else 2800,
    }


def _server_display_name(profile):
    return f"{profile.prenom} {profile.nom}".strip()


def _payment_currency(value):
    return value if value in {'USD', 'CDF'} else 'CDF'


def _convert_payment_amount(bar, total_usd, total_cdf, currency):
    currency = _payment_currency(currency)
    rate = Decimal(bar.taux_change_usd_to_cdf or 2800)
    total_usd = Decimal(total_usd or 0)
    total_cdf = Decimal(total_cdf or 0)
    if currency == 'USD':
        amount = total_usd + (total_cdf / rate)
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), rate
    amount = total_cdf + (total_usd * rate)
    return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP), rate


def _payment_label(amount, currency):
    if currency == 'CDF':
        return f"{amount:,.0f} FC".replace(',', ' ')
    return f"{amount:.2f} $"


def _order_payment_currency(order, fallback='CDF'):
    try:
        return _payment_currency(order.client_meta.payment_currency)
    except ClientOrderMeta.DoesNotExist:
        return _payment_currency(fallback)


def _server_loss_queryset(profile, pilot_profile=None):
    losses = Perte.objects.filter(bar=profile.bar)
    if pilot_profile:
        by_profile = losses.filter(reported_by=pilot_profile)
        if by_profile.exists():
            return by_profile
    # Backfill support for losses created before Perte.reported_by existed.
    display_name = _server_display_name(profile)
    return losses.filter(commentaire__icontains=f"Signalé par {display_name}")


def _loss_summary(losses):
    total_perte_usd = Decimal('0')
    total_perte_cdf = Decimal('0')
    pertes_par_produit = []
    items_perdus = losses.values('item__produit__nom', 'item__devise', 'item__prix_achat_unitaire').annotate(
        total_qty=Sum('quantite')
    ).order_by('-total_qty')

    for loss in items_perdus:
        amount = Decimal(loss['total_qty'] or 0) * Decimal(loss['item__prix_achat_unitaire'] or 0)
        if loss['item__devise'] == 'CDF':
            total_perte_cdf += amount
        else:
            total_perte_usd += amount
        pertes_par_produit.append({
            'nom': loss['item__produit__nom'],
            'quantite': loss['total_qty'],
            'montant': amount,
            'devise': loss['item__devise'],
        })

    return total_perte_usd, total_perte_cdf, pertes_par_produit


def _profit_summary(order_items):
    profit_usd = Decimal('0')
    profit_cdf = Decimal('0')
    for item in order_items.select_related('product_item'):
        revenue = Decimal(item.quantite or 0) * Decimal(item.prix_unitaire or 0)
        cost = Decimal(item.quantite or 0) * Decimal(item.product_item.prix_achat_unitaire or 0)
        profit = revenue - cost
        if item.devise == 'CDF':
            profit_cdf += profit
        else:
            profit_usd += profit
    return profit_usd, profit_cdf


def _client_debt_eligibility(*, bar, name='', phone=''):
    name = (name or '').strip()
    phone = (phone or '').strip()
    if not name and not phone:
        return {
            'total_spent_cdf': 0,
            'eligible': False,
            'is_manually_authorized': False,
            'client_found': False,
            'client_nom': '',
            'client_telephone': '',
            'seuil_dette_eligible': float(bar.seuil_dette_eligible or 0),
            'currency_rate': float(bar.taux_change_usd_to_cdf or 2800),
        }

    client_sub = Q()
    if phone:
        client_sub |= Q(telephone__contains=phone)
    if name:
        client_sub |= Q(nom__icontains=name)
    client = Client.objects.filter(Q(bar=bar) & client_sub).first()
    is_manually_authorized = bool(client and client.dette_autorisee)

    facture_sub = Q()
    if phone:
        facture_sub |= Q(client_fournisseur__contains=phone)
    if name:
        facture_sub |= Q(client_fournisseur__icontains=name)
    paid_factures = Facture.objects.filter(bar=bar, type_facture='CLIENT', statut='PAYEE').filter(facture_sub)
    totals = paid_factures.aggregate(total_usd=Sum('montant_usd'), total_cdf=Sum('montant_cdf'))
    rate = Decimal(bar.taux_change_usd_to_cdf or 2800)
    total_spent_cdf = Decimal(totals['total_cdf'] or 0) + (Decimal(totals['total_usd'] or 0) * rate)
    threshold = Decimal(bar.seuil_dette_eligible or 0)

    return {
        'total_spent_cdf': float(total_spent_cdf),
        'eligible': bool(is_manually_authorized or total_spent_cdf >= threshold),
        'is_manually_authorized': is_manually_authorized,
        'client_found': client is not None,
        'client_nom': client.nom if client else '',
        'client_telephone': client.telephone if client else '',
        'seuil_dette_eligible': float(threshold),
        'currency_rate': float(rate),
    }


class ServeurOwnerStyleSectionMixin(LoginRequiredMixin):
    def dispatch(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        if not profile.bar:
            return redirect('serveur_scan')
        if profile.confirmation_status == 'PENDING':
            return redirect('serveur_waiting_confirmation')
        if profile.confirmation_status == 'REJECTED':
            messages.error(request, "Votre demande d'affiliation a ete rejetee par le proprietaire.")
            return redirect('serveur_scan')
        self.serveur_profile = profile
        self.pilot_profile = PilotProfile.objects.filter(user=request.user, bar=profile.bar).first()
        return super().dispatch(request, *args, **kwargs)

class ServeurDashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'serveur/dashboard.html'

    def dispatch(self, request, *args, **kwargs):
        try:
            profile = ServeurProfile.objects.get(user=request.user)
        except ServeurProfile.DoesNotExist:
            return redirect('serveur_scan')

        if not profile.bar:
            return redirect('serveur_scan')

        if profile.confirmation_status == 'REJECTED':
            messages.error(request, "Votre demande d'affiliation a ete rejetee par le proprietaire.")
            return redirect('serveur_scan')

        if profile.confirmation_status == 'PENDING':
            return super().dispatch(request, *args, **kwargs)

        shift_actif = Shift.objects.filter(
            serveur=profile,
            status__in=['ACTIVE', 'BREAK']
        ).exists()
        if not shift_actif:
            return redirect('serveur_welcome')

        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = ServeurProfile.objects.get(user=self.request.user)
        bar = profile.bar
        context['profile'] = profile
        context['bar'] = bar
        context['is_pending_confirmation'] = profile.confirmation_status == 'PENDING'
        owner = (bar.owners.first() or bar.proprietaires.first()) if bar else None
        context['owner_name'] = f"{owner.prenom} {owner.nom}".strip() if owner else "the owner"

        if bar and profile.confirmation_status == 'PENDING':
            context.update({
                'active_orders': 0,
                'active_orders_list': [],
                'recent_orders': [],
                'critical_stocks': [],
                'served_tables': [],
                'tables_actives': 0,
                'tables_total': 0,
                'tables_capacity_percent': 0,
                'total_revenue_usd': 0,
                'total_revenue_cdf': 0,
                'revenue_growth_percent': 0,
                'last_paid_timestamp': '',
                "last_paid_time_str": "aucun aujourd'hui",
                'shift': None,
            })
            return context

        if bar:
            today = timezone.now().date()
            pilot_profile = PilotProfile.objects.filter(user=self.request.user).first()

            own_orders = Order.objects.filter(bar=bar, serveur=pilot_profile) if pilot_profile else Order.objects.none()
            own_today_orders = own_orders.filter(date_creation__date=today)
            own_paid_today = own_today_orders.filter(statut='PAID')
            active_own_orders = own_orders.filter(statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']).select_related('table').prefetch_related('items__product_item__produit').order_by('-date_creation')

            revenue_today = own_paid_today.aggregate(
                total_usd=Sum('total_usd'),
                total_cdf=Sum('total_cdf')
            )
            context['total_revenue_usd'] = revenue_today['total_usd'] or 0
            context['total_revenue_cdf'] = revenue_today['total_cdf'] or 0

            yesterday = today - timedelta(days=1)
            revenue_yesterday = own_orders.filter(statut='PAID', date_creation__date=yesterday).aggregate(
                total_usd=Sum('total_usd'),
                total_cdf=Sum('total_cdf')
            )
            rate = Decimal(bar.taux_change_usd_to_cdf or 2800)
            today_total_usd = Decimal(context['total_revenue_usd']) + (Decimal(context['total_revenue_cdf']) / rate)
            yesterday_total_usd = Decimal(revenue_yesterday['total_usd'] or 0) + (Decimal(revenue_yesterday['total_cdf'] or 0) / rate)
            if yesterday_total_usd > 0:
                growth = ((today_total_usd - yesterday_total_usd) / yesterday_total_usd) * 100
            elif today_total_usd > 0:
                growth = Decimal('100')
            else:
                growth = Decimal('0')
            context['revenue_growth_percent'] = float(growth)

            last_paid_order = own_orders.filter(statut='PAID').order_by('-date_maj').first()
            if last_paid_order:
                context['last_paid_timestamp'] = int(last_paid_order.date_maj.timestamp())
                diff_seconds = int((timezone.now() - last_paid_order.date_maj).total_seconds())
                if diff_seconds < 60:
                    context['last_paid_time_str'] = "à l'instant"
                elif diff_seconds < 3600:
                    context['last_paid_time_str'] = f"il y a {diff_seconds // 60} min"
                else:
                    context['last_paid_time_str'] = f"il y a {diff_seconds // 3600} h"
            else:
                context['last_paid_timestamp'] = ''
                context['last_paid_time_str'] = "aucun aujourd'hui"

            occupied_table_ids = Order.objects.filter(
                bar=bar,
                statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']
            ).values_list('table_id', flat=True).distinct()
            total_tables = Table.objects.filter(bar=bar).count()
            tables_actives = occupied_table_ids.count()
            context['tables_actives'] = tables_actives
            context['tables_total'] = total_tables
            context['tables_capacity_percent'] = int((tables_actives / total_tables) * 100) if total_tables else 0

            served_table_ids = own_today_orders.filter(statut__in=['SERVED', 'PAID']).values_list('table_id', flat=True).distinct()
            context['served_tables'] = Table.objects.filter(id__in=served_table_ids, bar=bar).order_by('nom')
            context['served_tables_count'] = context['served_tables'].count()

            context['active_orders'] = active_own_orders.count()
            context['active_orders_list'] = active_own_orders
            context['pilot_profile'] = pilot_profile
            context['recent_orders'] = (
                Order.objects.filter(bar=bar)
                .select_related('table', 'serveur')
                .prefetch_related('items__product_item__produit')
                .order_by('-date_creation')
            )
            context['personal_orders_today'] = own_today_orders.count()
            context['personal_served_today'] = own_today_orders.filter(statut__in=['SERVED', 'PAID']).count()

            context['tables'] = Table.objects.filter(bar=bar).order_by('nom')
            context['categories'] = Category.objects.all().order_by('nom')
            context['inventory_items'] = StockItem.objects.filter(bar=bar).select_related('produit', 'produit__categorie').order_by('produit__nom')

            critical_items = StockItem.objects.filter(
                bar=bar,
                quantite_actuelle__lte=F('seuil_alerte')
            ).select_related('produit')[:5]
            critical_stocks = []
            for item in critical_items:
                percent = int((item.quantite_actuelle / item.seuil_alerte * 100)) if item.seuil_alerte > 0 else 0
                critical_stocks.append({'item': item, 'percent': min(100, percent)})
            context['critical_stocks'] = critical_stocks

            context['shift'] = Shift.objects.filter(
                serveur=profile,
                status__in=['ACTIVE', 'BREAK']
            ).first()

        return context


class ServeurRecordLossView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user, confirmation_status='CONFIRMED', actif=True)
        if not profile.bar:
            return redirect('serveur_scan')

        item_ids = request.POST.getlist('item_id[]') or request.POST.getlist('item_id')
        quantities = request.POST.getlist('quantite[]') or request.POST.getlist('quantite')
        reasons = request.POST.getlist('raison[]') or request.POST.getlist('raison')
        comments = request.POST.getlist('commentaire[]') or request.POST.getlist('commentaire')

        pilot_profile = PilotProfile.objects.filter(user=request.user, role='SERVEUR', bar=profile.bar).first()

        created_count = 0
        for index, item_id in enumerate(item_ids):
            if not item_id:
                continue
            try:
                quantity = int(quantities[index]) if index < len(quantities) else 1
            except (TypeError, ValueError):
                quantity = 1
            quantity = max(1, quantity)
            reason = reasons[index] if index < len(reasons) and reasons[index] else 'CASSE'
            comment = comments[index] if index < len(comments) else ''
            item = get_object_or_404(StockItem, id=item_id, bar=profile.bar)

            Perte.objects.create(
                bar=profile.bar,
                item=item,
                reported_by=pilot_profile,
                quantite=quantity,
                raison=reason,
                commentaire=f"Signalé par {profile.prenom} {profile.nom}. {comment}".strip(),
            )
            item.quantite_actuelle = max(0, item.quantite_actuelle - quantity)
            item.save(update_fields=['quantite_actuelle'])
            created_count += 1

        if created_count:
            messages.success(request, f"{created_count} perte(s) enregistrée(s). Stock mis à jour.")
        else:
            messages.error(request, "Aucune perte valide à enregistrer.")
        return redirect('serveur_dashboard')

class ServeurAuthorizedSectionMixin(ServeurOwnerStyleSectionMixin):
    required_access_flag = None
    denied_message = "Vous n'avez pas accès à cette section."

    def get_serveur_profile(self, request):
        return get_object_or_404(ServeurProfile, user=request.user)


class ServeurInventoryView(ServeurOwnerStyleSectionMixin, TemplateView):
    template_name = 'proprietaire/inventory.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = self.serveur_profile
        context.update(_server_base_context(profile, self.pilot_profile))
        inventory_items = StockItem.objects.filter(bar=profile.bar).select_related('produit', 'produit__categorie').order_by('produit__nom')
        context['inventory_items'] = inventory_items
        context['categories'] = Category.objects.all().order_by('nom')
        context['stock_low_count'] = inventory_items.filter(quantite_actuelle__lte=F('seuil_alerte')).count()
        context['stock_total_count'] = inventory_items.count()
        context['stock_read_label'] = "Stock du bar en lecture seule"
        return context


class ServeurFinanceView(ServeurOwnerStyleSectionMixin, TemplateView):
    template_name = 'proprietaire/finance.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = self.serveur_profile
        pilot_profile = self.pilot_profile
        context.update(_server_base_context(profile, pilot_profile))
        bar = profile.bar
        if not bar or not pilot_profile:
            return context

        start_date_str = self.request.GET.get('start_date')
        end_date_str = self.request.GET.get('end_date')
        if start_date_str and end_date_str:
            start_date = timezone.datetime.strptime(start_date_str, '%Y-%m-%d').replace(tzinfo=timezone.get_current_timezone())
            end_date = timezone.datetime.strptime(end_date_str, '%Y-%m-%d').replace(tzinfo=timezone.get_current_timezone(), hour=23, minute=59, second=59)
        else:
            end_date = timezone.now()
            start_date = end_date - timedelta(days=30)

        context['start_date'] = start_date.strftime('%Y-%m-%d')
        context['end_date'] = end_date.strftime('%Y-%m-%d')

        own_paid_orders = Order.objects.filter(
            bar=bar,
            serveur=pilot_profile,
            statut='PAID',
            date_creation__range=(start_date, end_date),
        )
        revenue_data = own_paid_orders.aggregate(total_usd=Sum('total_usd'), total_cdf=Sum('total_cdf'), count=Count('id'))
        context['revenue_usd'] = revenue_data['total_usd'] or 0
        context['revenue_cdf'] = revenue_data['total_cdf'] or 0
        context['total_orders'] = revenue_data['count'] or 0
        if context['total_orders']:
            context['avg_basket_usd'] = context['revenue_usd'] / context['total_orders']
            context['avg_basket_cdf'] = context['revenue_cdf'] / context['total_orders']
        else:
            context['avg_basket_usd'] = 0
            context['avg_basket_cdf'] = 0

        losses = _server_loss_queryset(profile, pilot_profile).filter(date_perte__range=(start_date, end_date))
        loss_usd, loss_cdf, pertes_par_produit = _loss_summary(losses)
        context['total_perte_usd'] = loss_usd
        context['total_perte_cdf'] = loss_cdf
        context['pertes_par_produit'] = pertes_par_produit

        # Factures liées uniquement aux commandes servies par ce serveur.
        personal_factures = Facture.objects.filter(
            bar=bar,
            orders__serveur=pilot_profile,
        ).filter(
            Q(date_emission__range=(start_date, end_date)) | Q(statut='IMPAYEE')
        ).order_by('-date_emission').distinct()
        context['factures'] = personal_factures
        unpaid_personal = personal_factures.filter(type_facture='CLIENT', statut='IMPAYEE')
        unpaid_data = unpaid_personal.aggregate(total_usd=Sum('montant_usd'), total_cdf=Sum('montant_cdf'), count=Count('id'))
        context['personal_debt_usd'] = unpaid_data['total_usd'] or 0
        context['personal_debt_cdf'] = unpaid_data['total_cdf'] or 0
        context['personal_debt_count'] = unpaid_data['count'] or 0
        context['total_perte_usd'] += context['personal_debt_usd']
        context['total_perte_cdf'] += context['personal_debt_cdf']
        context['report_orders'] = own_paid_orders.select_related('table').order_by('-date_creation')[:20]
        context['inventory_items'] = StockItem.objects.filter(bar=bar).select_related('produit')

        from django.db import models as django_models
        order_items = OrderItem.objects.filter(order__in=own_paid_orders).select_related('product_item')
        profit_usd, profit_cdf = _profit_summary(order_items)
        context['gross_profit_usd'] = profit_usd
        context['gross_profit_cdf'] = profit_cdf
        context['net_profit_usd'] = profit_usd - Decimal(context['total_perte_usd'] or 0)
        context['net_profit_cdf'] = profit_cdf - Decimal(context['total_perte_cdf'] or 0)
        category_performance = []
        for cat in Category.objects.all():
            cat_items = order_items.filter(product_item__produit__categorie=cat)
            cat_revenue_usd = cat_items.filter(devise='USD').aggregate(total=Sum(django_models.F('quantite') * django_models.F('prix_unitaire')))['total'] or 0
            cat_revenue_cdf = cat_items.filter(devise='CDF').aggregate(total=Sum(django_models.F('quantite') * django_models.F('prix_unitaire')))['total'] or 0
            rate = Decimal(bar.taux_change_usd_to_cdf or 2800)
            cat_revenue_total_usd = Decimal(cat_revenue_usd or 0) + (Decimal(cat_revenue_cdf or 0) / rate)
            if cat_revenue_total_usd > 0:
                category_performance.append({'nom': cat.nom, 'icon': cat.icon or 'local_drink', 'revenue_usd': cat_revenue_usd, 'revenue_cdf': cat_revenue_cdf, 'revenue_total_usd': cat_revenue_total_usd, 'ventes_count': cat_items.count()})
        category_performance.sort(key=lambda x: x['revenue_total_usd'], reverse=True)
        context['category_performance'] = category_performance[:5]

        context['top_products'] = order_items.filter(devise='USD').values('product_item__produit__nom').annotate(
            total_qty=Sum('quantite'),
            total_revenue_usd=Sum(django_models.F('quantite') * django_models.F('prix_unitaire'), output_field=django_models.DecimalField())
        ).order_by('-total_revenue_usd')[:5]

        daily_performance = []
        for i in range(7):
            day = end_date - timedelta(days=6 - i)
            day_start = day.replace(hour=0, minute=0, second=0)
            day_end = day.replace(hour=23, minute=59, second=59)
            day_items = order_items.filter(order__date_creation__range=(day_start, day_end))
            day_revenue_usd = day_items.filter(devise='USD').aggregate(total=Sum(django_models.F('quantite') * django_models.F('prix_unitaire')))['total'] or 0
            day_revenue_cdf = day_items.filter(devise='CDF').aggregate(total=Sum(django_models.F('quantite') * django_models.F('prix_unitaire')))['total'] or 0
            daily_performance.append({'date': day.strftime('%d/%m'), 'revenue_usd': day_revenue_usd, 'revenue_cdf': day_revenue_cdf, 'ventes_count': day_items.count()})
        context['daily_performance'] = daily_performance
        return context


class ServeurClientsView(ServeurOwnerStyleSectionMixin, TemplateView):
    template_name = 'proprietaire/clients.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = self.serveur_profile
        pilot_profile = self.pilot_profile
        context.update(_server_base_context(profile, pilot_profile))
        bar = profile.bar
        if not bar or not pilot_profile:
            context['clients'] = []
            return context

        rate = Decimal(bar.taux_change_usd_to_cdf or 2800)
        own_orders = Order.objects.filter(
            bar=bar,
            serveur=pilot_profile,
        ).exclude(Q(client_name__isnull=True) & Q(client_phone__isnull=True))

        clients = {}
        for order in own_orders:
            key = (order.client_phone or '').strip() or (order.client_name or '').strip().lower()
            if not key:
                continue

            if key not in clients:
                client = Client.objects.filter(bar=bar).filter(Q(telephone__iexact=order.client_phone) | Q(nom__iexact=order.client_name)).first()
                clients[key] = {
                    'id': client.id if client else order.id,
                    'nom': (client.nom if client else order.client_name) or 'Client sans nom',
                    'telephone': (client.telephone if client else order.client_phone) or 'Non renseigné',
                    'dette_autorisee': client.dette_autorisee if client else False,
                    'total_spent_cdf': Decimal('0'),
                    'debt_usd': Decimal('0'),
                    'debt_cdf': Decimal('0'),
                    'orders_count': 0,
                    'paid_orders_count': 0,
                    'unpaid_orders_count': 0,
                    'last_order_at': None,
                    'eligible': False,
                }

            client_data = clients[key]
            client_data['orders_count'] += 1
            if not client_data['last_order_at'] or order.date_creation > client_data['last_order_at']:
                client_data['last_order_at'] = order.date_creation

            if order.statut == 'PAID':
                client_data['paid_orders_count'] += 1
                client_data['total_spent_cdf'] += Decimal(order.total_cdf or 0) + (Decimal(order.total_usd or 0) * rate)
            else:
                client_data['unpaid_orders_count'] += 1

        debt_factures = Facture.objects.filter(
            bar=bar,
            orders__serveur=pilot_profile,
            type_facture='CLIENT',
            statut='IMPAYEE',
        ).distinct()
        for facture in debt_factures.prefetch_related('orders'):
            matched_order = facture.orders.filter(serveur=pilot_profile).exclude(Q(client_name__isnull=True) & Q(client_phone__isnull=True)).first()
            if not matched_order:
                continue
            key = (matched_order.client_phone or '').strip() or (matched_order.client_name or '').strip().lower()
            if key in clients:
                clients[key]['debt_usd'] += Decimal(facture.montant_usd or 0)
                clients[key]['debt_cdf'] += Decimal(facture.montant_cdf or 0)

        for client_data in clients.values():
            client_data['eligible'] = client_data['dette_autorisee'] or client_data['total_spent_cdf'] >= Decimal(bar.seuil_dette_eligible or 0)
            client_data['payment_status_label'] = 'Impayé' if (client_data['debt_usd'] or client_data['debt_cdf'] or client_data['unpaid_orders_count']) else 'Payé'
            client_data['payment_status_class'] = 'bg-red-50 text-red-700 border-red-100' if client_data['payment_status_label'] == 'Impayé' else 'bg-emerald-50 text-emerald-700 border-emerald-100'

        context['clients'] = sorted(clients.values(), key=lambda c: (c['debt_cdf'] + c['debt_usd'] * rate, c['total_spent_cdf']), reverse=True)
        context['personal_clients_count'] = len(clients)
        context['personal_debt_clients_count'] = sum(1 for c in clients.values() if c['debt_usd'] or c['debt_cdf'])
        context['personal_paid_clients_count'] = sum(1 for c in clients.values() if not (c['debt_usd'] or c['debt_cdf'] or c['unpaid_orders_count']))
        return context


class ServeurTeamView(ServeurOwnerStyleSectionMixin, TemplateView):
    template_name = 'proprietaire/team.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = self.serveur_profile
        context.update(_server_base_context(profile, self.pilot_profile))
        bar = profile.bar
        owner_profile = (bar.owners.first() or bar.proprietaires.first()) if bar else None
        serveur_staff = list(ServeurProfile.objects.filter(bar=bar, confirmation_status='CONFIRMED', actif=True).select_related('user').order_by('date_embauche', 'prenom', 'nom')) if bar else []
        rate = Decimal(bar.taux_change_usd_to_cdf or 2800) if bar else Decimal('2800')
        for member in serveur_staff:
            member_pilot = PilotProfile.objects.filter(user=member.user, bar=bar).first()
            paid_orders = Order.objects.filter(bar=bar, serveur=member_pilot, statut='PAID') if member_pilot else Order.objects.none()
            served_orders = Order.objects.filter(bar=bar, serveur=member_pilot, statut__in=['SERVED', 'PAID']) if member_pilot else Order.objects.none()
            member.tables_managed = served_orders.values('table_id').distinct().count()
            member.orders_served = served_orders.count()
            member.paid_orders_count = paid_orders.count()
            totals = paid_orders.aggregate(total_usd=Sum('total_usd'), total_cdf=Sum('total_cdf'))
            member.impact_usd = totals['total_usd'] or 0
            member.impact_cdf = totals['total_cdf'] or 0
            member.impact_total_usd = Decimal(member.impact_usd or 0) + (Decimal(member.impact_cdf or 0) / rate)
            member.avg_order_usd = (member.impact_total_usd / member.paid_orders_count) if member.paid_orders_count else Decimal('0')
            open_debt = Facture.objects.filter(bar=bar, orders__serveur=member_pilot, type_facture='CLIENT', statut='IMPAYEE').distinct() if member_pilot else Facture.objects.none()
            debt_totals = open_debt.aggregate(total_usd=Sum('montant_usd'), total_cdf=Sum('montant_cdf'))
            member.open_debt_usd = debt_totals['total_usd'] or 0
            member.open_debt_cdf = debt_totals['total_cdf'] or 0
            member.is_current_server = member.user_id == self.request.user.id
            member.is_online = bool(member_pilot and member_pilot.is_online)

            member.hierarchy_level = 3
            member.hierarchy_label = 'Opérationnel'
            if member.tables_access_granted:
                member.hierarchy_level = 2
                member.hierarchy_label = 'Autonomie tables'
            if member.reports_access_granted:
                member.hierarchy_level = 1
                member.hierarchy_label = 'Responsable'
            if member.inventory_access_granted and member.hierarchy_level > 2:
                member.hierarchy_level = 2
                member.hierarchy_label = 'Autonomie inventaire'

            debt_penalty = Decimal(member.open_debt_usd or 0) + (Decimal(member.open_debt_cdf or 0) / rate)
            member.team_rating_score = float(
                (Decimal(member.impact_total_usd or 0) * Decimal('0.55'))
                + (Decimal(member.avg_order_usd or 0) * Decimal('0.30'))
                + (Decimal(member.paid_orders_count or 0) * Decimal('1.5'))
                + (Decimal(member.orders_served or 0) * Decimal('0.5'))
                - (debt_penalty * Decimal('0.25'))
            )
            member.team_rating_label = max(0.0, min(100.0, member.team_rating_score))

        serveur_staff.sort(key=lambda m: (
            m.hierarchy_level,
            -float(m.team_rating_label),
            m.date_embauche or timezone.now().date(),
            m.prenom or '',
            m.nom or '',
        ))
        for index, member in enumerate(serveur_staff, start=1):
            member.performance_rank = index
        context['owner_profile'] = owner_profile
        context['serveur_staff'] = serveur_staff
        context['pending_requests'] = []
        context['team_average_usd'] = (sum((m.impact_total_usd for m in serveur_staff), Decimal('0')) / len(serveur_staff)) if serveur_staff else Decimal('0')
        context['current_server_rank'] = next((m.performance_rank for m in serveur_staff if m.user_id == self.request.user.id), None)
        return context


class ServeurTablesView(ServeurOwnerStyleSectionMixin, TemplateView):
    template_name = 'proprietaire/tables.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = self.serveur_profile
        context.update(_server_base_context(profile, self.pilot_profile))
        bar = profile.bar
        tables = Table.objects.filter(bar=bar).order_by('nom') if bar else Table.objects.none()
        active_orders = Order.objects.filter(bar=bar, statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']).select_related('table', 'serveur') if bar else Order.objects.none()
        occupied_tables = {}
        for order in active_orders.order_by('-date_creation'):
            if order.table_id in occupied_tables:
                continue
            server_name = "Non assigné"
            if order.serveur:
                server_name = f"{order.serveur.prenom} {order.serveur.nom}".strip()
            occupied_tables[order.table_id] = {
                'order_id': order.id,
                'total_usd': order.total_usd,
                'total_cdf': order.total_cdf,
                'statut': order.get_statut_display(),
                'heure': order.date_creation,
                'server_name': server_name,
                'is_mine': bool(self.pilot_profile and order.serveur_id == self.pilot_profile.id),
            }
        mine_count = 0
        other_count = 0
        for table in tables:
            table.is_occupied = table.id in occupied_tables
            table.is_mine = False
            if table.is_occupied:
                table.order_info = occupied_tables[table.id]
                table.is_mine = table.order_info['is_mine']
                if table.is_mine:
                    mine_count += 1
                else:
                    other_count += 1
        context['tables'] = tables
        context['occupied_count'] = len(occupied_tables)
        context['server_occupied_count'] = mine_count
        context['other_occupied_count'] = other_count
        context['free_count'] = tables.count() - len(occupied_tables)
        return context


class ServeurTableActionView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user, actif=True)
        pilot_profile = PilotProfile.objects.filter(user=request.user, bar=profile.bar, role='SERVEUR').first()
        action = request.POST.get('action')
        table_id = request.POST.get('table_id')

        if action != 'liberate' or not table_id:
            payload = {'success': False, 'message': 'Action invalide.'}
            live = _live_payload(request, payload, status=400)
            if live is not None:
                return live
            messages.error(request, payload['message'])
            return redirect('serveur_tables')

        table = get_object_or_404(Table, id=table_id, bar=profile.bar)
        orders_to_close = list(Order.objects.filter(bar=profile.bar, table=table, statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']))
        now = timezone.now()
        updated = Order.objects.filter(id__in=[order.id for order in orders_to_close]).update(statut='PAID', date_maj=now)

        if orders_to_close:
            ClientOrderMeta.objects.filter(order__in=orders_to_close).update(payment_requested=False, payment_confirmed_by=pilot_profile, payment_confirmed_at=now, table_released_at=now, updated_at=now)
            notify_bar_owners(profile.bar, actor=request.user, category='TABLE', title=f'Table libérée - {table.nom}', message=f'{profile.prenom} {profile.nom} a libéré {table.nom}. {updated} commande(s) clôturée(s).', url=reverse('tables_html'))
            for order in orders_to_close:
                notify_order_status(order, actor=request.user, status_label='Payé')

        payload = {
            'success': True,
            'message': f"{table.nom} libérée. {updated} commande(s) clôturée(s).",
            'remove_selectors': [f'#table-card-{table.id}'],
            'dispatch_event': {'type': 'barpilote:tables-changed', 'detail': {'table_id': str(table.id), 'action': 'liberate', 'updated_orders': updated}},
        }
        live = _live_payload(request, payload)
        if live is not None:
            return live

        messages.success(request, payload['message'])
        return redirect('serveur_tables')


class ServeurReportView(ServeurFinanceView):
    pass


class ServeurScanQRView(LoginRequiredMixin, View):
    template_name = 'serveur/scan_qr.html'

    def link_invitation(self, request, code_str):
        try:
            profile, bar, _ = attach_user_to_bar(request.user, code_str)
        except InvitationError as exc:
            messages.error(request, str(exc))
            return render(request, self.template_name)

        if profile.confirmation_status == 'CONFIRMED':
            messages.success(request, f"Vous êtes déjà confirmé pour {bar.nom}.")
            return redirect('serveur_dashboard')

        owner = bar.owners.first() or bar.proprietaires.first()
        owner_name = f"{owner.prenom} {owner.nom}".strip() if owner else "the owner"
        messages.success(
            request,
            f"Awaiting confirmation from the owner ({owner_name}) of the establishment ({bar.nom})."
        )
        return redirect('serveur_setup')

    def get(self, request, *args, **kwargs):
        # Si un profil affilié existe déjà, rediriger
        try:
            profile = ServeurProfile.objects.get(user=request.user)
            if profile.bar:
                if profile.confirmation_status == 'PENDING':
                    return redirect('serveur_waiting_confirmation')
                elif profile.confirmation_status == 'CONFIRMED':
                    return redirect('serveur_dashboard')
                elif profile.confirmation_status == 'REJECTED':
                    messages.error(request, "Votre affiliation a été rejetée par le propriétaire.")
                    return render(request, self.template_name)
        except ServeurProfile.DoesNotExist:
            pass

        return render(request, self.template_name)

    def post(self, request, *args, **kwargs):
        action = request.POST.get('action')
        
        # Handle file import
        if action == 'file_import':
            qr_image = request.FILES.get('qr_image')
            if not qr_image:
                messages.error(request, "Veuillez sélectionner une image.")
                return render(request, self.template_name)

            try:
                from PIL import Image
                import cv2
                import numpy as np

                image = Image.open(qr_image).convert('RGB')
                opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                detector = cv2.QRCodeDetector()
                data, _bbox, _ = detector.detectAndDecode(opencv_image)

                if not data:
                    messages.error(request, "Aucun code QR détecté dans l'image.")
                    return render(request, self.template_name)

                return self.link_invitation(request, data)
            except ImportError:
                messages.error(
                    request,
                    "La lecture d'image QR nécessite OpenCV côté serveur. Utilisez la caméra ou la saisie manuelle."
                )
                return render(request, self.template_name)
            except Exception as e:
                messages.error(request, f"Erreur lors de la lecture du code QR: {str(e)}")
                return render(request, self.template_name)

        return self.link_invitation(request, request.POST.get('invitation_code'))


class ServeurJoinView(ServeurScanQRView):
    def get(self, request, code, *args, **kwargs):
        return self.link_invitation(request, code)

class ServeurWaitingConfirmationView(LoginRequiredMixin, View):
    template_name = 'serveur/waiting_confirmation.html'

    def get(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        
        if not profile.bar:
            return redirect('serveur_scan')
        
        if profile.confirmation_status == 'CONFIRMED':
            return redirect('serveur_dashboard')
        elif profile.confirmation_status == 'REJECTED':
            messages.error(request, "Votre affiliation a été rejetée par le propriétaire.")
            return redirect('serveur_scan')
        
        return render(request, self.template_name, {'profile': profile})

    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        
        # Allow profile info filling while waiting
        profile.nom = request.POST.get('nom', profile.nom).upper()
        profile.postnom = request.POST.get('postnom', profile.postnom).upper()
        profile.prenom = request.POST.get('prenom', profile.prenom).capitalize()
        profile.sexe = request.POST.get('sexe', profile.sexe)
        profile.telephone = request.POST.get('telephone', profile.telephone)
        
        age = request.POST.get('age')
        if age:
            profile.age = int(age)
        
        if 'photo' in request.FILES:
            profile.photo = request.FILES['photo']
            
        profile.save()
        messages.success(request, "Vos informations ont ete mises a jour. Votre tableau de bord restera vide jusqu'a l'approbation du proprietaire.")
        return redirect('serveur_dashboard')

class ServeurProfilSetupView(LoginRequiredMixin, View):
    template_name = 'serveur/profil_setup.html'

    def get(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        return render(request, self.template_name, {'profile': profile})

    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        
        profile.nom = request.POST.get('nom', '').upper()
        profile.postnom = request.POST.get('postnom', '').upper()
        profile.prenom = request.POST.get('prenom', '').capitalize()
        profile.sexe = request.POST.get('sexe', 'M')
        profile.telephone = request.POST.get('telephone', '')
        
        age = request.POST.get('age')
        if age:
            profile.age = int(age)
        
        if 'photo' in request.FILES:
            profile.photo = request.FILES['photo']
            
        profile.save()
        messages.success(request, "Profil configure. Votre tableau de bord restera vide jusqu'a l'approbation du proprietaire.")
        return redirect('serveur_dashboard')

class ServeurWelcomeView(LoginRequiredMixin, View):
    template_name = 'serveur/welcome.html'

    def get(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        
        # Si un shift est déjà actif, aller au dashboard
        shift_actif = Shift.objects.filter(
            serveur=profile,
            status__in=['ACTIVE', 'BREAK']
        ).first()
        if shift_actif:
            return redirect('serveur_dashboard')

        return render(request, self.template_name, {'profile': profile})

    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        
        # Démarrer le shift
        Shift.objects.create(
            serveur=profile,
            bar=profile.bar,
            start_time=timezone.now(),
            status='ACTIVE'
        )
        messages.success(request, "Bon service ! Votre quart de travail a commencé.")
        return redirect('serveur_dashboard')

class ServeurTakeOrderView(LoginRequiredMixin, View):
    template_name = 'serveur/take_order.html'

    def get_profile(self):
        return get_object_or_404(ServeurProfile, user=self.request.user)

    def dispatch(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        if not profile.bar:
            return redirect('serveur_scan')
        if profile.confirmation_status == 'PENDING':
            messages.info(request, "Votre tableau de bord restera vide jusqu'a l'approbation du proprietaire.")
            return redirect('serveur_dashboard')
        if profile.confirmation_status == 'REJECTED':
            messages.error(request, "Votre demande d'affiliation a ete rejetee par le proprietaire.")
            return redirect('serveur_scan')
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self):
        profile = self.get_profile()
        pilot_profile = PilotProfile.objects.filter(user=self.request.user, bar=profile.bar).first()
        context = _server_base_context(profile, pilot_profile)
        context.update({
            'tables': Table.objects.filter(bar=profile.bar, est_active=True).order_by('nom'),
            'categories': Category.objects.all().order_by('nom'),
            'inventory_items': StockItem.objects.filter(bar=profile.bar).select_related('produit', 'produit__categorie'),
        })
        return context

    def get(self, request, *args, **kwargs):
        return render(request, self.template_name, self.get_context_data())

    def post(self, request, *args, **kwargs):
        profile = self.get_profile()
        pilot_profile = get_object_or_404(PilotProfile, user=request.user, role='SERVEUR', bar=profile.bar)
        order = take_order_for_profile(
            bar=profile.bar,
            pilot_profile=pilot_profile,
            table_id=request.POST.get('table_id'),
            items_raw=request.POST.getlist('items[]'),
        )
        if order:
            messages.success(request, f"Commande enregistree pour {order.table.nom}.")
        else:
            messages.error(request, "Veuillez choisir une table et au moins un article.")
        return redirect('serveur_dashboard')

class ServeurCommandeDetailView(LoginRequiredMixin, View):
    template_name = 'serveur/commande_detail.html'

    def get(self, request, order_id, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        order = get_object_or_404(Order, id=order_id, bar=profile.bar)
        
        # Calcul du temps écoulé
        diff = timezone.now() - order.date_creation
        minutes = int(diff.total_seconds() // 60)
        
        pilot_profile = PilotProfile.objects.filter(user=request.user, role='SERVEUR', bar=profile.bar).first()
        context = _server_base_context(profile, pilot_profile)
        context.update({
            'order': order,
            'minutes_ago': minutes,
            'items': order.items.all().select_related('product_item__produit')
        })
        return render(request, self.template_name, context)

class ServeurMissionView(LoginRequiredMixin, View):
    template_name = 'serveur/mission.html'

    def get(self, request, order_id, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        order = get_object_or_404(Order, id=order_id, bar=profile.bar)
        
        return render(request, self.template_name, {
            'profile': profile,
            'order': order
        })

class ServeurShiftActionView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        action = request.POST.get('action')
        payload = {'success': False}
        
        if action == 'end_shift':
            shift = Shift.objects.filter(serveur=profile, status__in=['ACTIVE', 'BREAK']).first()
            if shift:
                shift.end_time = timezone.now()
                shift.status = 'ENDED'
                shift.save(update_fields=['end_time', 'status'])
                payload = {'success': True, 'message': 'Quart de travail terminé avec succès.', 'dispatch_event': {'type': 'barpilote:shift-ended', 'detail': {'shift_id': str(shift.id)}}}
            
        elif action in {'deliver', 'serve'}:
            order_id = request.POST.get('order_id')
            order = get_object_or_404(Order, id=order_id, bar=profile.bar)
            order.statut = 'SERVED'
            order.date_service = timezone.now()
            order.save(update_fields=['statut', 'date_service', 'date_maj'])
            notify_order_status(order, actor=request.user, status_label=order.get_statut_display())
            payload = {'success': True, 'message': f"La commande pour {order.table.nom} est marquée comme servie.", 'dispatch_event': {'type': 'barpilote:order-changed', 'detail': {'order_id': str(order.id), 'action': 'serve', 'status': 'SERVED'}}}
            
        elif action == 'pay':
            order_id = request.POST.get('order_id')
            order = get_object_or_404(Order, id=order_id, bar=profile.bar)
            order.statut = 'PAID'
            order.save(update_fields=['statut', 'date_maj'])
            notify_order_status(order, actor=request.user, status_label=order.get_statut_display())
            payload = {'success': True, 'message': f"La commande pour {order.table.nom} a été payée.", 'dispatch_event': {'type': 'barpilote:order-changed', 'detail': {'order_id': str(order.id), 'action': 'pay', 'status': 'PAID'}}}

        live = _live_payload(request, payload)
        if live is not None:
            return live
        if payload.get('success'):
            messages.success(request, payload['message'])
        return redirect('serveur_dashboard' if action != 'end_shift' else 'serveur_welcome')



class ServeurClientHistoryView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user, confirmation_status='CONFIRMED', actif=True)
        if not profile.bar:
            return JsonResponse({'error': 'Profil incomplet.'}, status=400)
        data = _client_debt_eligibility(
            bar=profile.bar,
            name=request.GET.get('name', ''),
            phone=request.GET.get('phone', ''),
        )
        return JsonResponse(data)



class ServeurClientOrderActionView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user, confirmation_status='CONFIRMED', actif=True)
        pilot_profile = get_object_or_404(PilotProfile, user=request.user, role='SERVEUR', bar=profile.bar)
        order = get_object_or_404(Order, id=request.POST.get('order_id'), bar=profile.bar)

        if order.serveur_id and order.serveur_id != pilot_profile.id:
            return JsonResponse({'error': 'Cette commande est assignée à un autre serveur.'}, status=403)
        if not order.serveur_id:
            order.serveur = pilot_profile
            order.save(update_fields=['serveur', 'date_maj'])

        meta, _ = ClientOrderMeta.objects.get_or_create(order=order)
        action = request.POST.get('action')

        if action == 'confirm_cash':
            currency = _payment_currency(request.POST.get('payment_currency') or 'USD')
            amount, rate = _convert_payment_amount(order.bar, order.total_usd, order.total_cdf, currency)
            order.statut = 'PAID'
            order.save(update_fields=['statut', 'date_maj'])
            meta.payment_currency = currency
            meta.payment_amount = amount
            meta.payment_rate = rate
            meta.payment_confirmed_by = pilot_profile
            meta.payment_confirmed_at = timezone.now()
            meta.payment_requested = False
            meta.save(update_fields=['payment_currency', 'payment_amount', 'payment_rate', 'payment_confirmed_by', 'payment_confirmed_at', 'payment_requested', 'updated_at'])
            notify_order_status(order, actor=request.user, status_label=f'Payée cash - {_payment_label(amount, currency)}')
            return JsonResponse({'success': True})

        if action == 'cancel':
            if order.statut == 'PAID':
                return JsonResponse({'error': 'Commande déjà payée.'}, status=400)
            reason = request.POST.get('reason', '').strip()
            order.statut = 'CANCELLED'
            order.save(update_fields=['statut', 'date_maj'])
            meta.cancelled_by = 'SERVEUR'
            meta.cancellation_reason = reason[:500]
            meta.save(update_fields=['cancelled_by', 'cancellation_reason', 'updated_at'])
            notify_bar_owners(profile.bar, actor=request.user, category='ORDER', title=f'Commande annulée - {order.table.nom}', message=f'Motif serveur: {reason or "Non précisé"}', url=reverse('dashboard_html'))
            return JsonResponse({'success': True})

        return JsonResponse({'error': 'Action invalide.'}, status=400)


class ServeurUpdateOrderStatusView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user, confirmation_status='CONFIRMED', actif=True)
        pilot_profile = get_object_or_404(PilotProfile, user=request.user, role='SERVEUR', bar=profile.bar)
        order_ids_raw = request.POST.get('order_id', '')
        new_status = request.POST.get('status', '')
        client_name = request.POST.get('client_name', '').strip()
        client_phone = request.POST.get('client_phone', '').strip()
        deferred = request.POST.get('deferred') == 'true'
        server_guarantee = request.POST.get('server_guarantee') == 'true'
        requested_payment_currency = _payment_currency(request.POST.get('payment_currency')) if request.POST.get('payment_currency') else None

        if not order_ids_raw or new_status not in {'ACCEPTEE', 'PREPARING', 'SERVED', 'PAID'}:
            return JsonResponse({'error': 'Paramètres invalides.'}, status=400)

        order_ids = [oid.strip() for oid in order_ids_raw.split(',') if oid.strip()]
        orders = Order.objects.filter(
            Q(serveur=pilot_profile) | Q(serveur__isnull=True),
            id__in=order_ids,
            bar=profile.bar,
        ).select_related('table')
        if not orders.exists():
            return JsonResponse({'error': 'Commande introuvable pour ce serveur.'}, status=404)
        if orders.count() != len(order_ids):
            return JsonResponse({'error': 'Une commande est déjà assignée à un autre serveur.'}, status=403)

        if deferred:
            eligibility = _client_debt_eligibility(bar=profile.bar, name=client_name, phone=client_phone)
            if not eligibility['eligible'] and not server_guarantee:
                return JsonResponse({
                    'error': "Client non éligible à la dette. Le serveur doit se porter garant pour continuer.",
                    'eligible': False,
                    'requires_guarantee': True,
                }, status=403)
        else:
            eligibility = None

        for order in orders:
            if not order.serveur_id:
                order.serveur = pilot_profile
            order.statut = new_status
            if new_status in {'ACCEPTEE', 'PREPARING'} and not order.date_service:
                order.date_service = timezone.now()
            if new_status == 'SERVED':
                order.date_service = timezone.now()
            if client_name:
                order.client_name = client_name
            if client_phone:
                order.client_phone = client_phone
            order.save()

        facture_id = None
        if new_status == 'PAID':
            orders_list = list(orders)
            total_usd = sum(order.total_usd for order in orders_list)
            total_cdf = sum(order.total_cdf for order in orders_list)
            payment_currency = requested_payment_currency or _order_payment_currency(orders_list[0])
            converted_amount, payment_rate = _convert_payment_amount(profile.bar, total_usd, total_cdf, payment_currency)
            facture_usd = converted_amount if payment_currency == 'USD' else Decimal('0')
            facture_cdf = converted_amount if payment_currency == 'CDF' else Decimal('0')
            table_nom = orders_list[0].table.nom if orders_list[0].table else 'Comptoir'
            if client_name and client_phone:
                client_nom_complet = f"{client_name} ({client_phone})"
            elif client_name:
                client_nom_complet = client_name
            elif client_phone:
                client_nom_complet = f"Client {client_phone}"
            else:
                client_nom_complet = f"Client - {table_nom}"

            short_uuid = str(uuid.uuid4())[:4].upper()
            date_str = timezone.now().strftime('%y%m%d')
            notes_lines = [
                f"Dette enregistrée par serveur pour {len(orders_list)} commande(s) - {table_nom}" if deferred else f"Paiement serveur de {len(orders_list)} commande(s) - {table_nom}",
                f"Serveur: {profile.prenom} {profile.nom}",
                f"Montant encaissé en {payment_currency}: {_payment_label(converted_amount, payment_currency)}",
                f"Total original: {total_usd:.2f} USD + {total_cdf:.0f} CDF; taux: 1 USD = {payment_rate:.0f} CDF",
            ]
            guaranteed_by = None
            if deferred:
                if eligibility and eligibility['eligible']:
                    notes_lines.append("Dette autorisée: client éligible selon la liste/historique propriétaire.")
                if server_guarantee:
                    guaranteed_by = pilot_profile
                    notes_lines.append(f"Garant serveur: {profile.prenom} {profile.nom}")

            facture = Facture.objects.create(
                bar=profile.bar,
                numero=f"FAC-{date_str}-{short_uuid}",
                client_fournisseur=client_nom_complet,
                montant_usd=facture_usd,
                montant_cdf=facture_cdf,
                type_facture='CLIENT',
                statut='IMPAYEE' if deferred else 'PAYEE',
                guaranteed_by=guaranteed_by,
                notes="\n".join(notes_lines),
            )
            facture.orders.set(orders_list)
            facture_id = str(facture.id)
            for order in orders_list:
                order_currency = requested_payment_currency or _order_payment_currency(order, payment_currency)
                order_amount, order_rate = _convert_payment_amount(profile.bar, order.total_usd, order.total_cdf, order_currency)
                meta, _ = ClientOrderMeta.objects.get_or_create(order=order)
                meta.payment_currency = order_currency
                meta.payment_amount = order_amount
                meta.payment_rate = order_rate
                if not deferred:
                    meta.payment_confirmed_by = pilot_profile
                    meta.payment_confirmed_at = timezone.now()
                    meta.payment_requested = False
                update_fields = ['payment_currency', 'payment_amount', 'payment_rate', 'updated_at']
                if not deferred:
                    update_fields += ['payment_confirmed_by', 'payment_confirmed_at', 'payment_requested']
                meta.save(update_fields=update_fields)

        for order in orders:
            notify_order_status(order, actor=request.user, status_label=order.get_statut_display())
        response_data = {'success': True, 'new_status': new_status, 'facture_id': facture_id}
        if new_status == 'PAID':
            response_data.update({
                'payment_currency': payment_currency,
                'payment_amount': float(converted_amount),
                'payment_label': _payment_label(converted_amount, payment_currency),
            })
        return JsonResponse(response_data)



class ServeurToggleCurrencyView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(ServeurProfile, user=request.user)
        pilot_profile, _ = PilotProfile.objects.get_or_create(user=request.user)
        if profile.bar and pilot_profile.bar_id != profile.bar_id:
            pilot_profile.bar = profile.bar
        if pilot_profile.role != 'SERVEUR':
            pilot_profile.role = 'SERVEUR'
        pilot_profile.preferred_currency = 'CDF' if pilot_profile.preferred_currency == 'USD' else 'USD'
        pilot_profile.save(update_fields=['bar', 'role', 'preferred_currency'])
        return JsonResponse({
            'currency': pilot_profile.preferred_currency,
            'exchange_rate': float(profile.bar.taux_change_usd_to_cdf or 2800) if profile.bar else 2800,
        })

class ServeurLogoutView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        logout(request)
        messages.success(request, "Vous avez ete deconnecte de l'espace serveur.")
        return redirect('login_html')

    def post(self, request, *args, **kwargs):
        return self.get(request, *args, **kwargs)
