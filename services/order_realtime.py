from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Sum
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone

from services.consumers import bar_dashboard_group_name, client_order_group_name, server_dashboard_group_name


def _server_photo_url(order):
    if not getattr(order, 'serveur_id', None):
        return ''
    try:
        serveur_profile = order.serveur.user.serveur_profile
        if getattr(serveur_profile, 'photo', None):
            return serveur_profile.photo.url
    except Exception:
        pass
    try:
        if getattr(order.serveur, 'photo_profil', None):
            return order.serveur.photo_profil.url
    except Exception:
        pass
    return ''


def serialize_order_for_realtime(order):
    items = []
    for item in order.items.select_related('product_item__produit'):
        items.append({
            'id': str(item.product_item_id),
            'name': item.product_item.produit.nom,
            'qty': int(item.quantite or 0),
            'price': float(item.prix_unitaire or 0),
            'unit': item.unite_vente,
            'devise': item.devise,
        })
    try:
        meta = order.client_meta
    except Exception:
        meta = None
    payment_currency = getattr(meta, 'payment_currency', 'CDF') or 'CDF'
    rate = Decimal(order.bar.taux_change_usd_to_cdf or 2800)
    total_usd = Decimal(order.total_usd or 0)
    total_cdf = Decimal(order.total_cdf or 0)
    if payment_currency == 'USD':
        payment_amount = (total_usd + (total_cdf / rate)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    else:
        payment_amount = (total_cdf + (total_usd * rate)).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    payment_requested = bool(meta and meta.has_payment_request)
    payment_confirmed = bool(meta and meta.payment_confirmed_at)

    return {
        'id': str(order.id),
        'table_nom': order.table.nom if order.table_id else 'Comptoir',
        'statut': order.statut,
        'status_label': order.get_statut_display(),
        'accepted_label': 'Commande acceptée',
        'total_usd': float(order.total_usd or 0),
        'total_cdf': float(order.total_cdf or 0),
        'payment_currency': payment_currency,
        'payment_amount': float(payment_amount or 0),
        'payment_rate': float(rate or 0),
        'payment_requested': payment_requested,
        'payment_requested_at': meta.payment_requested_at.isoformat() if meta and meta.payment_requested_at else None,
        'payment_confirmed': payment_confirmed,
        'payment_confirmed_at': meta.payment_confirmed_at.isoformat() if meta and meta.payment_confirmed_at else None,
        'table_released': bool(meta and meta.table_released_at),
        'table_released_at': meta.table_released_at.isoformat() if meta and meta.table_released_at else None,
        'debt_requested': bool(getattr(meta, 'debt_requested', False)),
        'debt_status': getattr(meta, 'debt_status', 'NONE') if meta else 'NONE',
        'debt_due_date': meta.debt_due_date.isoformat() if meta and meta.debt_due_date else None,
        'debt_requested_at': meta.debt_requested_at.isoformat() if meta and meta.debt_requested_at else None,
        'debt_handled_at': meta.debt_handled_at.isoformat() if meta and meta.debt_handled_at else None,
        'debt_handled_by': f'{meta.debt_handled_by.prenom} {meta.debt_handled_by.nom}'.strip() if meta and meta.debt_handled_by else '',
        'debt_response_reason': meta.debt_response_reason if meta else '',
        'repeat_after_minutes': getattr(meta, 'repeat_after_minutes', None),
        'total_euros': float(order.total_usd or 0),
        'timestamp': order.date_creation.timestamp(),
        'date_creation': order.date_creation.isoformat(),
        'date_service': order.date_service.isoformat() if order.date_service else None,
        'delivery_duration': int((order.date_service - order.date_creation).total_seconds()) if order.date_service else None,
        'server_id': str(order.serveur_id) if order.serveur_id else '',
        'server': f'{order.serveur.prenom} {order.serveur.nom}'.strip() if order.serveur_id else '',
        'server_photo_url': _server_photo_url(order),
        'items': items,
    }


def dashboard_totals_for_bar(bar):
    today = timezone.localdate()
    paid_orders = bar.orders.filter(statut='PAID', date_creation__date=today)
    totals = paid_orders.aggregate(
        usd=Sum('total_usd'),
        cdf=Sum('total_cdf'),
    )
    last_paid_order = paid_orders.order_by('-date_maj').first()
    return {
        'today_revenue_usd': float(totals['usd'] or 0),
        'today_revenue_cdf': float(totals['cdf'] or 0),
        'active_orders_count': bar.orders.filter(statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']).count(),
        'last_paid_timestamp': int(last_paid_order.date_maj.timestamp()) if last_paid_order else None,
    }


def dashboard_totals_for_server(order):
    if not order.serveur_id:
        return {}
    today = timezone.localdate()
    paid_orders = order.bar.orders.filter(
        serveur_id=order.serveur_id,
        statut='PAID',
        date_creation__date=today,
    )
    totals = paid_orders.aggregate(
        usd=Sum('total_usd'),
        cdf=Sum('total_cdf'),
    )
    last_paid_order = paid_orders.order_by('-date_maj').first()
    return {
        'server_id': str(order.serveur_id),
        'today_revenue_usd': float(totals['usd'] or 0),
        'today_revenue_cdf': float(totals['cdf'] or 0),
        'last_paid_timestamp': int(last_paid_order.date_maj.timestamp()) if last_paid_order else None,
    }


def broadcast_order_changed(order):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    order_payload = serialize_order_for_realtime(order)
    dashboard_payload = dashboard_totals_for_bar(order.bar)

    # Téléphone client: canal dédié à la commande QR.
    async_to_sync(channel_layer.group_send)(
        client_order_group_name(order.id),
        {'type': 'commande.changed', 'commande': order_payload},
    )

    # Tableau propriétaire: groupe général des gérants.
    async_to_sync(channel_layer.group_send)(
        bar_dashboard_group_name(order.bar_id),
        {'type': 'proprietaire.commande_accepted', 'commande': order_payload, 'dashboard': dashboard_payload},
    )

    # Dashboards serveurs du bar: chaque client rafraîchit sa liste filtrée.
    async_to_sync(channel_layer.group_send)(
        server_dashboard_group_name(order.bar_id),
        {'type': 'serveur.commande_changed', 'commande': order_payload, 'dashboard': dashboard_totals_for_server(order)},
    )

def broadcast_order_accepted(order):
    broadcast_order_changed(order)
