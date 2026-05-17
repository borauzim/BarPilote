from .models import PilotProfile

def currency_context(request):
    """
    Fournit la devise préférée et le taux de change globalement.
    """
    if request.user.is_authenticated:
        try:
            profile = PilotProfile.objects.select_related('bar').get(user=request.user)
            return {
                'pref_currency': profile.preferred_currency,
                'exchange_rate': profile.bar.taux_change_usd_to_cdf if profile.bar else 2800,
            }
        except PilotProfile.DoesNotExist:
            pass
    return {
        'pref_currency': 'USD',
        'exchange_rate': 2800,
    }
