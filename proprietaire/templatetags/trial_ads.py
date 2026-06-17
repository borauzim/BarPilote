from django import template

register = template.Library()

ADS = [
    {
        "icon": "campaign",
        "headline": "BarPilote reste visible pendant l'essai gratuit",
        "message": "Votre établissement est encore dans sa période de découverte. Les espaces sponsorisés restent affichés pour tous les utilisateurs.",
    },
    {
        "icon": "ads_click",
        "headline": "Lancement SaaS par table",
        "message": "Chaque table participe à la facturation du bar après la période gratuite. Le tarif est défini par établissement.",
    },
    {
        "icon": "local_offer",
        "headline": "Offre de démarrage active",
        "message": "Profitez de 30 jours gratuits pendant lesquels une bannière sponsorisée accompagne chaque interface.",
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

    return {
        'show_banner': True,
        'days_left': days_left,
        'audience_label': audience_label,
        'icon': creative['icon'],
        'headline': creative['headline'],
        'message': creative['message'],
        'banner_key': f"trial-ad-{getattr(bar, 'id', 'global')}-{audience}",
    }
