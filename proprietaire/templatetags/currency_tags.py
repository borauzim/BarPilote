from django import template
from decimal import Decimal

register = template.Library()

@register.simple_tag(takes_context=True)
def display_price(context, amount_usd=None, amount_cdf=None):
    """
    Affiche le prix dans la monnaie préférée de l'utilisateur (pref_currency).
    Combine et convertit intelligemment les montants USD et CDF si les deux sont fournis.
    """
    pref = context.get('pref_currency', 'USD')
    rate = Decimal(context.get('exchange_rate', 2800))
    
    # Sécurité pour les valeurs None
    val_usd = Decimal(amount_usd) if amount_usd is not None else Decimal('0.00')
    val_cdf = Decimal(amount_cdf) if amount_cdf is not None else Decimal('0.00')

    if pref == 'USD':
        total_usd = val_usd + (val_cdf / rate)
        return f"{total_usd:.2f} $"
    else:
        total_cdf = val_cdf + (val_usd * rate)
        return f"{total_cdf:,.0f} FC"

@register.filter
def mul(value, arg):
    """Multiplie la valeur par l'argument"""
    try:
        return float(value) * float(arg)
    except (ValueError, TypeError):
        return 0

import json
from urllib.parse import quote

@register.filter
def jsonify_order_items(order):
    """Transforme les items d'une commande en JSON string pour le modal JS"""
    items_data = []
    for item in order.items.all():
        items_data.append({
            'name': item.product_item.produit.nom,
            'qty': item.quantite,
            'price': float(item.prix_unitaire),
            'devise': item.devise
        })
    return quote(json.dumps(items_data))
