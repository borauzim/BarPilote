import io
import re
import uuid
from types import SimpleNamespace

from django.contrib import messages
from django.db import transaction
from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Count, Q
from django.http import FileResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views import View
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from proprietaire.models import Bar, Category, Facture, Order, OrderItem, PilotProfile, StockItem, Table
from proprietaire.notifications import notify_bar_owners, notify_bar_servers, notify_debt_created, notify_order_status, notify_user
from proprietaire.order_services import inventory_price_for_unit
from proprietaire.html_views import draw_facture_page
from serveur.models import ServeurProfile, Shift
from .models import ClientOrderMeta, ClientServiceRating

ACTIVE_STATUSES = ['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']


def _money(usd, cdf):
    parts = []
    if usd:
        parts.append(f'{usd:.2f} $')
    if cdf:
        parts.append(f'{cdf:,.0f} FC'.replace(',', ' '))
    return ' + '.join(parts) if parts else '0 $'


def _payment_currency(value):
    return value if value in {'USD', 'CDF'} else 'CDF'


def _converted_payment_amount(order, currency=None):
    if not currency:
        try:
            currency = order.client_meta.payment_currency
        except ClientOrderMeta.DoesNotExist:
            currency = 'CDF'
    currency = _payment_currency(currency)
    rate = Decimal(order.bar.taux_change_usd_to_cdf or 2800)
    total_usd = Decimal(order.total_usd or 0)
    total_cdf = Decimal(order.total_cdf or 0)
    if currency == 'USD':
        amount = total_usd + (total_cdf / rate)
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), currency, rate
    amount = total_cdf + (total_usd * rate)
    return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP), currency, rate


def _payment_label(order, currency=None):
    amount, currency, _rate = _converted_payment_amount(order, currency)
    if currency == 'CDF':
        return f'{amount:,.0f} FC'.replace(',', ' ')
    return f'{amount:.2f} $'


def _client_display_name(order, meta=None):
    parts = [order.client_name or '']
    if meta:
        parts.extend([meta.client_postnom or '', meta.client_prenom or ''])
    name = ' '.join(part.strip() for part in parts if part and part.strip())
    return name or 'Client'


def _invoice_profile_for_bar(bar):
    profile = PilotProfile.objects.filter(bar=bar, role='PROPRIETAIRE').select_related('user', 'bar').first()
    if not profile:
        profile = PilotProfile.objects.filter(bar=bar).select_related('user', 'bar').first()
    if profile:
        return profile
    return SimpleNamespace(bar=bar, telephone='', user=SimpleNamespace(email=''))


def _unique_invoice_number(order):
    base = f"FAC-{timezone.localtime().strftime('%y%m%d')}-{order.id.hex[:6].upper()}"
    if not Facture.objects.filter(numero=base).exists():
        return base
    return f"{base}-{uuid.uuid4().hex[:4].upper()}"


def _facture_for_order(order):
    try:
        meta = order.client_meta
    except ClientOrderMeta.DoesNotExist:
        meta = None
    facture = order.factures.filter(type_facture='CLIENT').order_by('-date_emission').first()
    client_name = _client_display_name(order, meta)
    status = 'PAYEE' if order.statut == 'PAID' else 'IMPAYEE'

    if facture:
        update_fields = []
        for field, value in {
            'client_fournisseur': client_name,
            'montant_usd': order.total_usd,
            'montant_cdf': order.total_cdf,
        }.items():
            if getattr(facture, field) != value:
                setattr(facture, field, value)
                update_fields.append(field)
        if order.statut == 'PAID' and facture.statut != 'PAYEE':
            facture.statut = 'PAYEE'
            facture.date_paiement = timezone.now()
            update_fields.extend(['statut', 'date_paiement'])
        if update_fields:
            facture.save(update_fields=update_fields)
        return facture

    facture = Facture.objects.create(
        bar=order.bar,
        numero=_unique_invoice_number(order),
        client_fournisseur=client_name,
        montant_usd=order.total_usd,
        montant_cdf=order.total_cdf,
        type_facture='CLIENT',
        statut=status,
        date_paiement=timezone.now() if status == 'PAYEE' else None,
    )
    facture.orders.add(order)
    return facture


def _remember_client_order(request, table, order):
    key = f'client_orders_{table.id}'
    order_ids = [value for value in request.session.get(key, []) if value]
    order_id = str(order.id)
    if order_id in order_ids:
        order_ids.remove(order_id)
    request.session[key] = [order_id, *order_ids][:30]
    request.session.modified = True


def _client_order_queryset(request, table):
    order_ids = request.session.get(f'client_orders_{table.id}', [])
    session_key = request.session.session_key
    query = Q(id__in=order_ids) if order_ids else Q(pk__isnull=True)
    if session_key:
        query |= Q(client_meta__session_key=session_key)
    active_order_id = request.session.get(f'client_order_{table.id}')
    if active_order_id:
        query |= Q(id=active_order_id)
    return (
        Order.objects.filter(table=table)
        .filter(query)
        .select_related('bar', 'table', 'serveur')
        .prefetch_related('items__product_item__produit', 'factures')
        .distinct()
        .order_by('-date_creation')
    )


def _active_order_for_table(request, table):
    active_order_id = request.session.get(f'client_order_{table.id}')
    if not active_order_id:
        return None
    return Order.objects.filter(id=active_order_id, table=table).exclude(statut__in=['PAID', 'CANCELLED']).first()


def _status_steps(order):
    steps = [
        ('PENDING', 'Reçue', 'Commande transmise'),
        ('ACCEPTEE', 'Acceptée', 'Commande acceptée'),
        ('PREPARING', 'Préparation', 'La vigie prépare'),
        ('SERVED', 'Servie', 'À votre table'),
        ('PAID', 'Payée', 'Service clôturé'),
    ]
    if order.statut == 'CANCELLED':
        return [{'code': 'CANCELLED', 'label': 'Annulée', 'caption': 'Commande arrêtée', 'active': True, 'done': True}]
    current = next((index for index, step in enumerate(steps) if step[0] == order.statut), 0)
    return [
        {
            'code': code,
            'label': label,
            'caption': caption,
            'active': index == current,
            'done': index <= current,
        }
        for index, (code, label, caption) in enumerate(steps)
    ]



def _whatsapp_url(phone):
    digits = re.sub(r'\D+', '', phone or '')
    if not digits:
        return ''
    if digits.startswith('00'):
        digits = digits[2:]
    if digits.startswith('0'):
        digits = '243' + digits[1:]
    elif len(digits) == 9 and digits[0] in {'8', '9'}:
        digits = '243' + digits
    return f'https://wa.me/{digits}'


def _owner_for_bar(bar):
    owner = PilotProfile.objects.filter(bar=bar, role='PROPRIETAIRE').select_related('user').first()
    if not owner and bar:
        owner = bar.owners.select_related('user').first() or bar.proprietaires.select_related('user').first()
    if not owner:
        return None
    full_name = ' '.join(part.strip() for part in [owner.prenom, owner.nom, owner.postnom] if part and part.strip())
    phone = owner.telephone or ''
    return {
        'name': full_name or owner.user.get_full_name() or owner.user.username,
        'phone': phone,
        'whatsapp_url': _whatsapp_url(phone),
    }

def _cart_lines(bar, post_data):
    lines = []
    for key, value in post_data.items():
        if not key.startswith('qty_'):
            continue
        try:
            stock_id = key.replace('qty_', '', 1)
            qty = int(value or 0)
        except (TypeError, ValueError):
            continue
        if qty <= 0:
            continue
        unit = post_data.get(f'unit_{stock_id}', 'BOUTEILLE')
        if unit not in {'BOUTEILLE', 'VERRE'}:
            continue
        try:
            stock_item = StockItem.objects.select_related('produit', 'produit__categorie').get(id=stock_id, bar=bar)
            price = inventory_price_for_unit(stock_item, unit)
        except (StockItem.DoesNotExist, ValueError):
            continue
        lines.append((stock_item, qty, unit, price))
    return lines


def _free_server_for_bar(bar):
    active_server_ids = set(Order.objects.filter(bar=bar, statut__in=ACTIVE_STATUSES, serveur__isnull=False).values_list('serveur_id', flat=True))
    active_shift_users = set(Shift.objects.filter(bar=bar, status='ACTIVE').values_list('serveur__user_id', flat=True))
    server_profiles = (
        ServeurProfile.objects.filter(bar=bar, actif=True, confirmation_status='CONFIRMED', user_id__in=active_shift_users)
        .select_related('user')
        .order_by('updated_at')
    )
    for server_profile in server_profiles:
        pilot = PilotProfile.objects.filter(user=server_profile.user, bar=bar, role='SERVEUR').first()
        if pilot and pilot.id not in active_server_ids:
            return pilot
    return None


def _notify_assignment(order, label='Client QR'):
    if order.serveur:
        notify_user(
            order.serveur.user,
            bar=order.bar,
            category='ORDER',
            title=f'Commande assignée - {order.table.nom}',
            message=f'{label} attend votre service sur {order.table.nom}.',
            url=reverse('serveur_dashboard'),
        )
    notify_bar_owners(
        order.bar,
        category='ORDER',
        title=f'Nouvelle commande client - {order.table.nom}',
        message=f'{label} a commandé depuis le QR client. Serveur: {order.serveur.prenom if order.serveur else "aucun libre"}.',
        url=reverse('dashboard_html'),
    )
    if not order.serveur:
        notify_bar_servers(
            order.bar,
            category='ORDER',
            title=f'Commande client non assignée - {order.table.nom}',
            message='Aucun serveur libre détecté. Un responsable doit prendre la commande.',
            url=reverse('serveur_dashboard'),
        )


def _active_order_quantities(order):
    quantities = {}
    for item in order.items.all():
        quantities[str(item.product_item_id)] = quantities.get(str(item.product_item_id), 0) + int(item.quantite or 0)
    return quantities


def _copy_order(source, *, assign_server=True):
    server = _free_server_for_bar(source.bar) if assign_server else source.serveur
    order = Order.objects.create(
        bar=source.bar,
        table=source.table,
        serveur=server,
        statut='PENDING',
        client_name=source.client_name,
        client_phone=source.client_phone,
    )
    for item in source.items.select_related('product_item'):
        OrderItem.objects.create(
            order=order,
            product_item=item.product_item,
            unite_vente=item.unite_vente,
            quantite=item.quantite,
            prix_unitaire=item.prix_unitaire,
            devise=item.devise,
        )
    order.recalculate_totals()
    source_meta = getattr(source, 'client_meta', None)
    ClientOrderMeta.objects.create(
        order=order,
        session_key=source_meta.session_key if source_meta else '',
        client_postnom=source_meta.client_postnom if source_meta else '',
        client_prenom=source_meta.client_prenom if source_meta else '',
        note=source_meta.note if source_meta else '',
        repeat_after_minutes=source_meta.repeat_after_minutes if source_meta else None,
        repeat_source=source,
        payment_currency=source_meta.payment_currency if source_meta else 'CDF',
    )
    _notify_assignment(order, source.client_name or source.client_phone or 'Client QR')
    return order


class ClientMenuView(View):
    template_name = 'client/menu.html'

    def get_table(self, table_id):
        return get_object_or_404(Table.objects.select_related('bar'), id=table_id, est_active=True)

    def get_menu_bar(self, table):
        return table.bar

    def get(self, request, table_id):
        table = self.get_table(table_id)
        menu_bar = self.get_menu_bar(table)
        items = (
            StockItem.objects.filter(bar=menu_bar)
            .select_related('produit', 'produit__categorie')
            .order_by('produit__categorie__nom', 'produit__nom')
        )
        visible_items = [item for item in items if item.can_sell_bottle or item.can_sell_glass]
        category_ids = {item.produit.categorie_id for item in visible_items if item.produit.categorie_id}
        categories = Category.objects.filter(id__in=category_ids).order_by('nom')
        active_order = _active_order_for_table(request, table)
        return render(request, self.template_name, {
            'bar': menu_bar,
            'table': table,
            'categories': categories,
            'items': visible_items,
            'active_order': active_order,
            'active_quantities': _active_order_quantities(active_order) if active_order else {},
            'item_count': len(visible_items),
            'establishment_owner': _owner_for_bar(menu_bar),
        })

    @transaction.atomic
    def post(self, request, table_id):
        table = self.get_table(table_id)
        menu_bar = self.get_menu_bar(table)
        lines = _cart_lines(menu_bar, request.POST)
        client_name = ''
        client_postnom = ''
        client_prenom = ''
        client_phone = ''
        note = ''

        if not lines:
            messages.error(request, 'Choisissez au moins un produit avant de commander.')
            return redirect('client_menu', table_id=table.id)

        active_order = _active_order_for_table(request, table)

        if active_order:
            order = active_order
            if not order.serveur:
                order.serveur = _free_server_for_bar(menu_bar)
            order.save(update_fields=['serveur', 'date_maj'])
        else:
            server = _free_server_for_bar(menu_bar)
            order = Order.objects.create(
                bar=menu_bar,
                table=table,
                serveur=server,
                statut='PENDING',
                client_name=client_name,
                client_phone=client_phone,
            )
            if not request.session.session_key:
                request.session.save()
            request.session[f'client_order_{table.id}'] = str(order.id)

        existing_pairs = {(item.product_item_id, item.unite_vente): item for item in order.items.all()}
        for stock_item, qty, unit, price in lines:
            key = (stock_item.id, unit)
            if key in existing_pairs:
                existing = existing_pairs[key]
                existing.quantite += qty
                existing.prix_unitaire = price
                existing.devise = stock_item.devise
                existing.save(update_fields=['quantite', 'prix_unitaire', 'devise'])
            else:
                OrderItem.objects.create(
                    order=order,
                    product_item=stock_item,
                    unite_vente=unit,
                    quantite=qty,
                    prix_unitaire=price,
                    devise=stock_item.devise,
                )

        meta, _ = ClientOrderMeta.objects.get_or_create(order=order)
        meta.session_key = request.session.session_key or meta.session_key
        meta.payment_currency = _payment_currency(request.POST.get('payment_currency') or meta.payment_currency)
        meta.save(update_fields=['session_key', 'payment_currency', 'updated_at'])
        order.recalculate_totals()
        _remember_client_order(request, table, order)
        _notify_assignment(order, 'Client QR')
        return redirect('client_track_order', order_id=order.id)


class ClientTrackOrderView(View):
    template_name = 'client/track_order.html'

    def get(self, request, order_id):
        order = Order.objects.select_related('bar', 'table', 'serveur').prefetch_related('items__product_item__produit').filter(id=order_id).first()
        if not order:
            return render(request, 'client/order_missing.html', {
                'order_id': order_id,
                'message': "Cette commande n'existe plus ou a été supprimée."
            }, status=200)

        meta, _ = ClientOrderMeta.objects.get_or_create(order=order)
        rating = getattr(order, 'client_rating', None)
        client_display_name = _client_display_name(order, meta)
        payment_amount, payment_currency, payment_rate = _converted_payment_amount(order, meta.payment_currency)
        return render(request, self.template_name, {
            'order': order,
            'meta': meta,
            'rating': rating,
            'items': order.items.select_related('product_item__produit'),
            'total_label': _money(order.total_usd, order.total_cdf),
            'payment_label': _payment_label(order, payment_currency),
            'payment_currency': payment_currency,
            'payment_amount': payment_amount,
            'payment_rate': payment_rate,
            'server_phone': order.serveur.telephone if order.serveur else '',
            'server_name': f'{order.serveur.prenom} {order.serveur.nom}'.strip() if order.serveur else 'Serveur en attente',
            'client_display_name': client_display_name,
            'client_first_name': (meta.client_prenom or order.client_name or 'Client').split()[0],
            'status_steps': _status_steps(order),
            'can_rate': order.statut in ['SERVED', 'PAID'],
            'establishment_owner': _owner_for_bar(order.bar),
        })


class ClientHistoryView(View):
    template_name = 'client/history.html'

    def get(self, request, table_id):
        table = get_object_or_404(Table.objects.select_related('bar'), id=table_id, est_active=True)
        orders = list(_client_order_queryset(request, table)[:30])
        active_order = _active_order_for_table(request, table)
        return render(request, self.template_name, {
            'table': table,
            'bar': table.bar,
            'orders': orders,
            'active_order': active_order,
            'establishment_owner': _owner_for_bar(table.bar),
        })


class ClientInvoicesView(View):
    template_name = 'client/invoices.html'

    def get(self, request, table_id):
        table = get_object_or_404(Table.objects.select_related('bar'), id=table_id, est_active=True)
        orders = list(_client_order_queryset(request, table)[:30])
        for order in orders:
            if order.items.exists() and not order.factures.filter(type_facture='CLIENT').exists():
                _facture_for_order(order)
        factures = (
            Facture.objects.filter(orders__in=orders, type_facture='CLIENT')
            .select_related('bar')
            .prefetch_related('orders')
            .distinct()
            .order_by('-date_emission')
        )
        active_order = _active_order_for_table(request, table)
        return render(request, self.template_name, {
            'table': table,
            'bar': table.bar,
            'factures': factures,
            'active_order': active_order,
            'establishment_owner': _owner_for_bar(table.bar),
        })


class ClientOrderStatusAPIView(View):
    def get(self, request, order_id):
        order = get_object_or_404(Order.objects.select_related('table', 'serveur'), id=order_id)
        meta, _ = ClientOrderMeta.objects.get_or_create(order=order)
        payment_amount, payment_currency, payment_rate = _converted_payment_amount(order, meta.payment_currency)
        return JsonResponse({
            'id': str(order.id),
            'status': order.statut,
            'status_label': order.get_statut_display(),
            'table': order.table.nom,
            'server': f'{order.serveur.prenom} {order.serveur.nom}'.strip() if order.serveur else '',
            'payment_requested': meta.has_payment_request,
            'payment_confirmed': bool(meta.payment_confirmed_at),
            'debt_requested': meta.debt_requested,
            'table_released': bool(meta.table_released_at),
            'repeat_after_minutes': meta.repeat_after_minutes,
            'total_usd': float(order.total_usd),
            'total_cdf': float(order.total_cdf),
            'payment_currency': payment_currency,
            'payment_amount': float(payment_amount),
            'payment_label': _payment_label(order, payment_currency),
            'payment_rate': float(payment_rate),
            'updated_at': order.date_maj.isoformat(),
        })


class ClientOrderActionView(View):
    @transaction.atomic
    def post(self, request, order_id):
        order = get_object_or_404(Order.objects.select_related('bar', 'table', 'serveur'), id=order_id)
        meta, _ = ClientOrderMeta.objects.get_or_create(order=order)
        action = request.POST.get('action')

        if action == 'cancel':
            if order.statut == 'PAID':
                return JsonResponse({'error': 'Commande déjà payée.'}, status=400)
            reason = request.POST.get('reason', '').strip()
            order.statut = 'CANCELLED'
            order.save(update_fields=['statut', 'date_maj'])
            meta.cancellation_reason = reason[:500]
            meta.cancelled_by = 'CLIENT'
            meta.save(update_fields=['cancellation_reason', 'cancelled_by', 'updated_at'])
            notify_order_status(order, status_label='Annulée par le client')
            return JsonResponse({'success': True, 'status': order.statut})

        if action == 'identity':
            order.client_name = request.POST.get('client_name', '').strip()[:255]
            order.client_phone = request.POST.get('client_phone', '').strip()[:20]
            order.save(update_fields=['client_name', 'client_phone', 'date_maj'])
            meta.client_postnom = request.POST.get('client_postnom', '').strip()[:120]
            meta.client_prenom = request.POST.get('client_prenom', '').strip()[:120]
            meta.note = request.POST.get('note', '').strip()[:500]
            meta.payment_currency = _payment_currency(request.POST.get('payment_currency') or meta.payment_currency)
            meta.save(update_fields=['client_postnom', 'client_prenom', 'note', 'payment_currency', 'updated_at'])
            return JsonResponse({'success': True})

        if action in {'debt', 'pay_cash', 'repeat', 'reminder'} and order.statut in {'PAID', 'CANCELLED'}:
            return JsonResponse({'error': 'Commande déjà clôturée.'}, status=400)

        if action == 'release_table' and meta.table_released_at:
            return JsonResponse({'success': True})

        if action == 'debt':
            reason = request.POST.get('reason', '').strip()
            meta.debt_requested = True
            meta.debt_reason = reason[:500]
            meta.save(update_fields=['debt_requested', 'debt_reason', 'updated_at'])
            notify_bar_owners(order.bar, category='DEBT', title=f'Demande de dette - {order.table.nom}', message=f'{order.client_name or "Client"} demande une dette.', url=reverse('dashboard_html'))
            if order.serveur:
                notify_user(order.serveur.user, bar=order.bar, category='DEBT', title=f'Demande de dette - {order.table.nom}', message='Le client demande un paiement différé.', url=reverse('serveur_dashboard'))
            return JsonResponse({'success': True})

        if action == 'pay_cash':
            order.client_name = request.POST.get('client_name', order.client_name or '').strip()[:255]
            order.client_phone = request.POST.get('client_phone', order.client_phone or '').strip()[:20]
            if order.client_name or order.client_phone:
                order.save(update_fields=['client_name', 'client_phone', 'date_maj'])

            meta.client_prenom = request.POST.get('client_prenom', meta.client_prenom or '').strip()[:120]
            meta.client_postnom = request.POST.get('client_postnom', meta.client_postnom or '').strip()[:120]
            meta.note = request.POST.get('note', meta.note or '').strip()[:500]
            meta.payment_currency = _payment_currency(request.POST.get('payment_currency') or meta.payment_currency)
            amount, currency, rate = _converted_payment_amount(order, meta.payment_currency)
            meta.payment_amount = amount
            meta.payment_rate = rate
            meta.save(update_fields=['client_prenom', 'client_postnom', 'note', 'payment_currency', 'payment_amount', 'payment_rate', 'updated_at'])
            meta.mark_payment_requested()

            def _score(name):
                try:
                    value = int(request.POST.get(name) or 0)
                except ValueError:
                    value = 0
                return value if 1 <= value <= 5 else None

            rating, _ = ClientServiceRating.objects.get_or_create(order=order, defaults={'server': order.serveur})
            rating.server = order.serveur
            rating.server_score = _score('server_score')
            rating.bar_score = _score('bar_score')
            rating.comment = request.POST.get('comment', '').strip()[:800]
            rating.save()

            if order.serveur:
                notify_user(order.serveur.user, bar=order.bar, category='ORDER', title=f'Paiement cash à confirmer - {order.table.nom}', message='Le client indique avoir payé en cash. Confirmez la réception.', url=reverse('serveur_dashboard'))
            return JsonResponse({'success': True})

        if action == 'repeat':
            repeat = _copy_order(order)
            return JsonResponse({'success': True, 'order_url': reverse('client_track_order', args=[repeat.id])})

        if action == 'reminder':
            try:
                minutes = int(request.POST.get('minutes') or 30)
            except ValueError:
                minutes = 30
            meta.repeat_after_minutes = max(5, min(minutes, 240))
            meta.save(update_fields=['repeat_after_minutes', 'updated_at'])
            return JsonResponse({'success': True, 'minutes': meta.repeat_after_minutes})

        if action == 'release_table':
            if order.statut != 'PAID':
                return JsonResponse({'error': 'La table pourra être libérée après confirmation du paiement.'}, status=400)
            meta.table_released_at = timezone.now()
            meta.save(update_fields=['table_released_at', 'updated_at'])
            if request.session.get(f'client_order_{order.table.id}') == str(order.id):
                request.session.pop(f'client_order_{order.table.id}', None)
            notify_bar_owners(order.bar, category='TABLE', title=f'Table libérée - {order.table.nom}', message='Le client a signalé la libération de la table.', url=reverse('dashboard_html'))
            return JsonResponse({'success': True})

        if action == 'rate':
            def _score(name):
                try:
                    value = int(request.POST.get(name) or 0)
                except ValueError:
                    value = 0
                return value if 1 <= value <= 5 else None
            rating, _ = ClientServiceRating.objects.get_or_create(order=order, defaults={'server': order.serveur})
            rating.server = order.serveur
            rating.server_score = _score('server_score')
            rating.bar_score = _score('bar_score')
            rating.comment = request.POST.get('comment', '').strip()[:800]
            rating.save()
            return JsonResponse({'success': True})

        return JsonResponse({'error': 'Action invalide.'}, status=400)


class ClientInvoiceDownloadView(View):
    @transaction.atomic
    def get(self, request, order_id):
        order = get_object_or_404(
            Order.objects.select_related('bar', 'table').prefetch_related('items__product_item__produit'),
            id=order_id,
        )
        order.recalculate_totals()
        facture = _facture_for_order(order)
        profile = _invoice_profile_for_bar(order.bar)

        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        draw_facture_page(pdf, facture, profile)
        pdf.save()
        buffer.seek(0)

        date_str = timezone.localtime(facture.date_emission).strftime('%Y%m%d')
        client_clean = ''.join(c if c.isalnum() else '_' for c in facture.client_fournisseur).strip('_')[:30]
        filename = f"Facture_{date_str}_{client_clean or order.id.hex[:6].upper()}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename)
