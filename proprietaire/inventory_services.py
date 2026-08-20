from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone


STOCK_PRECISION = Decimal("0.001")
WHOLE_BOTTLE_TOLERANCE = Decimal("0.002")


def _stock_reduction(line):
    quantity = Decimal(line.quantite or 0)
    if line.unite_vente == "VERRE":
        bottle_cl = Decimal(line.product_item.produit.volume_cl or 0)
        glass_cl = Decimal(line.product_item.volume_verre_cl or 0)
        if bottle_cl <= 0 or glass_cl <= 0:
            return Decimal("0")
        return quantity * glass_cl / bottle_cl
    return quantity


def _rounded_stock(value):
    value = max(Decimal("0"), value)
    nearest_bottle = value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if abs(value - nearest_bottle) <= WHOLE_BOTTLE_TOLERANCE:
        return nearest_bottle.quantize(STOCK_PRECISION)
    return value.quantize(STOCK_PRECISION, rounding=ROUND_HALF_UP)


@transaction.atomic
def deduct_inventory_for_paid_order(order):
    """Déduit le stock une seule fois lorsque la commande devient payée."""
    from .models import Order, StockItem

    locked_order = Order.objects.select_for_update().get(pk=order.pk)
    if locked_order.statut != "PAID" or locked_order.stock_deducted_at:
        return False

    reductions = {}
    lines = locked_order.items.select_related("product_item__produit")
    for line in lines:
        reductions[line.product_item_id] = reductions.get(line.product_item_id, Decimal("0")) + _stock_reduction(line)

    for stock_id, reduction in reductions.items():
        stock = StockItem.objects.select_for_update().get(pk=stock_id)
        stock.quantite_actuelle = _rounded_stock(Decimal(stock.quantite_actuelle) - reduction)
        stock.save(update_fields=["quantite_actuelle"])

    locked_order.stock_deducted_at = timezone.now()
    locked_order.save(update_fields=["stock_deducted_at"])
    order.stock_deducted_at = locked_order.stock_deducted_at
    return True
