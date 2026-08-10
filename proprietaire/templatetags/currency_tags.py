from django import template
from decimal import Decimal
from django.utils.safestring import mark_safe

register = template.Library()


def _money_span(text, kind, **attrs):
    payload = {
        'class': 'bp-money',
        'data-bp-kind': kind,
    }
    for key, value in attrs.items():
        if value is None:
            continue
        payload[key] = value

    rendered_attrs = ' '.join(f'{key}="{value}"' for key, value in payload.items())
    return mark_safe(f'<span {rendered_attrs}>{text}</span>')

@register.simple_tag(takes_context=True)
def display_price(context, amount_usd=None, amount_cdf=None):
    """
    Affiche le prix dans la monnaie préférée de l'utilisateur (pref_currency).
    Combine et convertit intelligemment les montants USD et CDF si les deux sont fournis.
    """
    pref = context.get('pref_currency', 'USD')
    rate = Decimal(context.get('exchange_rate', 2800))

    try:
        if amount_usd is not None and amount_usd != '':
            val_usd = Decimal(str(amount_usd))
        else:
            val_usd = Decimal('0.00')
    except Exception:
        val_usd = Decimal('0.00')

    try:
        if amount_cdf is not None and amount_cdf != '':
            val_cdf = Decimal(str(amount_cdf))
        else:
            val_cdf = Decimal('0.00')
    except Exception:
        val_cdf = Decimal('0.00')

    if pref == 'USD':
        total_usd = val_usd + (val_cdf / rate)
        return _money_span(
            f"{total_usd:.2f} $",
            'display_price',
            **{
                'data-bp-amount-usd': str(val_usd),
                'data-bp-amount-cdf': str(val_cdf),
                'data-bp-rate': str(rate),
                'data-bp-display-currency': 'USD',
            },
        )
    else:
        total_cdf = val_cdf + (val_usd * rate)
        return _money_span(
            f"{total_cdf:,.0f} FC".replace(',', ' '),
            'display_price',
            **{
                'data-bp-amount-usd': str(val_usd),
                'data-bp-amount-cdf': str(val_cdf),
                'data-bp-rate': str(rate),
                'data-bp-display-currency': 'CDF',
            },
        )


def _format_money_amount(amount, currency):
    try:
        value = Decimal(str(amount or 0))
    except Exception:
        value = Decimal('0')
    if currency == 'CDF':
        return f"{value:,.0f} FC".replace(',', ' ')
    return f"{value:.2f} $"


@register.simple_tag
def order_total(amount_usd=None, amount_cdf=None):
    """Affiche le total réel d'une commande sans convertir les devises."""
    try:
        val_usd = Decimal(str(amount_usd or 0))
    except Exception:
        val_usd = Decimal('0')
    try:
        val_cdf = Decimal(str(amount_cdf or 0))
    except Exception:
        val_cdf = Decimal('0')
    parts = []
    if val_usd:
        parts.append(_format_money_amount(val_usd, 'USD'))
    if val_cdf:
        parts.append(_format_money_amount(val_cdf, 'CDF'))
    return _money_span(
        ' + '.join(parts) if parts else '0.00 $',
        'order_total',
        **{
            'data-bp-amount-usd': str(val_usd),
            'data-bp-amount-cdf': str(val_cdf),
        },
    )


@register.simple_tag
def money_amount(amount=None, currency='USD'):
    return _money_span(
        _format_money_amount(amount, currency),
        'money_amount',
        **{
            'data-bp-amount': str(amount or 0),
            'data-bp-currency': currency,
        },
    )



@register.simple_tag(takes_context=True)
def usd_amount(context, amount=None, currency='USD', quantity=1):
    """Affiche un montant converti en USD avec le taux du contexte."""
    try:
        value = Decimal(str(amount or 0)) * Decimal(str(quantity or 1))
    except Exception:
        value = Decimal('0')
    try:
        rate = Decimal(str(context.get('exchange_rate', 2800) or 2800))
    except Exception:
        rate = Decimal('2800')
    if currency == 'CDF':
        value = value / rate
    return _money_span(
        f"{value:.2f} $",
        'usd_amount',
        **{
            'data-bp-amount': str(amount or 0),
            'data-bp-currency': currency,
            'data-bp-quantity': str(quantity or 1),
            'data-bp-rate': str(rate),
        },
    )

@register.filter
def get_item(mapping, key):
    try:
        return mapping.get(str(key), mapping.get(key)) if hasattr(mapping, 'get') else ''
    except Exception:
        return ''


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
            'id': str(item.product_item_id),
            'name': item.product_item.produit.nom,
            'qty': item.quantite,
            'price': float(item.prix_unitaire),
            'unit': item.unite_vente,
            'devise': item.devise
        })
    return quote(json.dumps(items_data))
