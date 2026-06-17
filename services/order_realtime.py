from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Sum
from django.utils import timezone

from services.consumers import bar_dashboard_group_name, client_order_group_name


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
    return {
        'id': str(order.id),
        'table_nom': order.table.nom if order.table_id else 'Comptoir',
        'statut': order.statut,
        'status_label': order.get_statut_display(),
        'accepted_label': 'Commande acceptée',
        'total_usd': float(order.total_usd or 0),
        'total_cdf': float(order.total_cdf or 0),
        'total_euros': float(order.total_usd or 0),
        'timestamp': order.date_creation.timestamp(),
        'date_creation': order.date_creation.isoformat(),
        'date_service': order.date_service.isoformat() if order.date_service else None,
        'server': f'{order.serveur.prenom} {order.serveur.nom}'.strip() if order.serveur_id else '',
        'items': items,
    }


def dashboard_totals_for_bar(bar):
    today = timezone.localdate()
    totals = bar.orders.filter(statut='PAID', date_creation__date=today).aggregate(
        usd=Sum('total_usd'),
        cdf=Sum('total_cdf'),
    )
    return {
        'today_revenue_usd': float(totals['usd'] or 0),
        'today_revenue_cdf': float(totals['cdf'] or 0),
        'active_orders_count': bar.orders.filter(statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']).count(),
    }


def broadcast_order_accepted(order):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    order_payload = serialize_order_for_realtime(order)
    dashboard_payload = dashboard_totals_for_bar(order.bar)

    # Téléphone client: canal dédié à la commande QR.
    async_to_sync(channel_layer.group_send)(
        client_order_group_name(order.id),
        {'type': 'commande.accepted', 'commande': order_payload},
    )

    # Tableau propriétaire: groupe général des gérants.
    async_to_sync(channel_layer.group_send)(
        bar_dashboard_group_name(order.bar_id),
        {'type': 'proprietaire.commande_accepted', 'commande': order_payload, 'dashboard': dashboard_payload},
    )
