from django.conf import settings
from django.utils import timezone
from .models import Order, PilotProfile


def _current_bar(profile):
    if profile.bar:
        return profile.bar
    return profile.owned_bars.order_by('-date_creation').first()


def currency_context(request):
    """
    Fournit la devise preferee, le taux de change global et l'etablissement actif.
    """
    if request.user.is_authenticated:
        try:
            profile = PilotProfile.objects.select_related('bar').prefetch_related('owned_bars').get(user=request.user)
            active_bar = _current_bar(profile)
            live_orders_count = 0
            if active_bar:
                live_orders_count = Order.objects.filter(
                    bar=active_bar,
                    date_creation__date=timezone.localdate(),
                ).exclude(
                    statut__in=['PAID', 'CANCELLED'],
                ).count()
            return {
                'pref_currency': profile.preferred_currency,
                'exchange_rate': active_bar.taux_change_usd_to_cdf if active_bar else 2800,
                'current_bar': active_bar,
                'owned_bars': list(profile.owned_bars.all()),
                'live_orders_count': live_orders_count,
                'developer_contact_email': settings.DEVELOPER_CONTACT_EMAIL,
            }
        except PilotProfile.DoesNotExist:
            pass
    return {
        'pref_currency': 'USD',
        'exchange_rate': 2800,
        'current_bar': None,
        'owned_bars': [],
        'live_orders_count': 0,
        'developer_contact_email': settings.DEVELOPER_CONTACT_EMAIL,
    }
