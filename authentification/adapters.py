from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth.models import User


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    """Relie Google au compte BarPilote qui possède déjà le même email."""

    def pre_social_login(self, request, sociallogin):
        super().pre_social_login(request, sociallogin)
        if sociallogin.is_existing or sociallogin.account.provider != 'google':
            return

        email = User.objects.normalize_email(
            (sociallogin.user.email or sociallogin.account.extra_data.get('email') or '').strip()
        ).lower()
        if not email or not self._google_email_is_verified(sociallogin, email):
            return

        users = list(User.objects.filter(email__iexact=email).order_by('id')[:2])
        if len(users) != 1 or not users[0].is_active:
            return
        sociallogin.connect(request, users[0])

    @staticmethod
    def _google_email_is_verified(sociallogin, email):
        if sociallogin.account.extra_data.get('email_verified') is True:
            return True
        return any(
            address.verified and address.email.lower() == email
            for address in sociallogin.email_addresses
        )
