from proprietaire.models import Order, OrderItem, StockItem, Table


def inventory_price_for_unit(stock_item, unit):
    if unit == 'BOUTEILLE' and stock_item.can_sell_bottle:
        return stock_item.prix_vente_unitaire
    if unit == 'VERRE' and stock_item.can_sell_glass:
        return stock_item.prix_vente_verre
    raise ValueError(f"Unsupported sale unit for inventory item: {unit}")


def _valid_order_lines(*, bar, items_raw):
    lines = []
    for item_str in items_raw:
        try:
            sid, qty, unit = item_str.split(':')
            qty = int(qty)
            if qty <= 0:
                continue
            if unit not in {'BOUTEILLE', 'VERRE'}:
                continue

            stock_item = StockItem.objects.select_related('produit', 'produit__categorie').get(id=sid, bar=bar)
            price = inventory_price_for_unit(stock_item, unit)
            lines.append((stock_item, qty, unit, price))
        except (StockItem.DoesNotExist, TypeError, ValueError) as exc:
            print(f"Skipping invalid order item: {exc}")
    return lines


def take_order_for_profile(*, bar, pilot_profile, table_id, items_raw):
    if not table_id or not items_raw:
        return None

    try:
        table = Table.objects.get(id=table_id, bar=bar)
    except Table.DoesNotExist:
        return None

    valid_lines = _valid_order_lines(bar=bar, items_raw=items_raw)
    if not valid_lines:
        return None

    order = Order.objects.filter(table=table, statut__in=['PENDING', 'PREPARING']).first()
    if not order:
        order = Order.objects.create(
            bar=bar,
            table=table,
            serveur=pilot_profile,
            statut='PENDING',
        )

    for stock_item, qty, unit, price in valid_lines:
        OrderItem.objects.create(
            order=order,
            product_item=stock_item,
            unite_vente=unit,
            quantite=qty,
            prix_unitaire=price,
            devise=stock_item.devise,
        )

    order.recalculate_totals()
    return order
