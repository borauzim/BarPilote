from django import template
from django.conf import settings

register = template.Library()

ADS = [
    {
        "icon": "campaign",
        "headline": "BarPilote sponsorise votre mois d'essai",
        "message": "Cet établissement utilise BarPilote gratuitement pendant 30 jours. Cette publicité finance l'accès découverte.",
    },
    {
        "icon": "ads_click",
        "headline": "Commandes QR, stock et finances en direct",
        "message": "BarPilote centralise les tables, les serveurs, les clients et les pertes pendant l'essai gratuit.",
    },
    {
        "icon": "local_offer",
        "headline": "Offre de démarrage active",
        "message": "Le premier mois est gratuit pour tester l'établissement avec propriétaires, serveurs et clients.",
    },
]

@register.inclusion_tag('includes/trial_ad_banner.html', takes_context=True)
def trial_ad_banner(context, bar=None, audience='owner'):
    if bar is None:
        return {'show_banner': False}

    days_left = getattr(bar, 'jours_restants', 0) or 0
    if days_left <= 0:
        return {'show_banner': False}

    index = int(getattr(getattr(bar, 'id', None), 'int', 0) or 0) % len(ADS)
    creative = ADS[index]
    audience_label = {
        'owner': 'Propriétaire',
        'server': 'Serveur',
        'client': 'Client',
    }.get(audience, 'Utilisateur')

    adsense_client = getattr(settings, 'GOOGLE_ADSENSE_CLIENT_ID', '')
    adsense_slots = {
        'owner': getattr(settings, 'GOOGLE_ADSENSE_SLOT_OWNER', ''),
        'server': getattr(settings, 'GOOGLE_ADSENSE_SLOT_SERVER', ''),
        'client': getattr(settings, 'GOOGLE_ADSENSE_SLOT_CLIENT', ''),
    }
    adsense_slot = adsense_slots.get(audience, '')

    return {
        'show_banner': True,
        'use_adsense': bool(adsense_client and adsense_slot),
        'adsense_client': adsense_client,
        'adsense_slot': adsense_slot,
        'days_left': days_left,
        'audience_label': audience_label,
        'icon': creative['icon'],
        'headline': creative['headline'],
        'message': creative['message'],
        'banner_key': f"trial-ad-{getattr(bar, 'id', 'global')}-{audience}",
        'bar_name': getattr(bar, 'nom', 'cet établissement'),
    }
