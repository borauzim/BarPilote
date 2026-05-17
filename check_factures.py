import os
import django
from django.utils import timezone
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'barpilote.settings')
django.setup()

from proprietaire.models import Facture, Order

facture_count = Facture.objects.count()
paid_orders = Order.objects.filter(statut='PAID')
print(f"Total Factures: {facture_count}")
print(f"Total PAID Orders: {paid_orders.count()}")

# Group orders by table and date to avoid duplicates
# Since we just added this feature today, let's see how many PAID orders we have.
for order in paid_orders:
    print(f"Order {order.id} - {order.table.nom if order.table else 'Comptoir'} - {order.total_usd}$")
