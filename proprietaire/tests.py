from django.template import Context, Template
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .models import Bar


class TrialAdBannerTests(TestCase):
    def test_trial_ad_banner_renders_fallback_for_active_trial_bar(self):
        bar = Bar.objects.create(nom="Pub Test", abonnement_expire_le=timezone.now() + timezone.timedelta(days=30))

        html = Template("{% load trial_ads %}{% trial_ad_banner bar 'client' %}").render(Context({'bar': bar}))

        self.assertIn("Publicité BarPilote", html)
        self.assertIn("Essai gratuit", html)
        self.assertIn("Pub Test", html)
        self.assertIn("Client", html)
        self.assertNotIn("adsbygoogle", html)

    @override_settings(
        GOOGLE_ADSENSE_CLIENT_ID="ca-pub-1234567890123456",
        GOOGLE_ADSENSE_SLOT_CLIENT="1234567890",
    )
    def test_trial_ad_banner_renders_google_adsense_when_configured(self):
        bar = Bar.objects.create(nom="Pub Test", abonnement_expire_le=timezone.now() + timezone.timedelta(days=30))

        html = Template("{% load trial_ads %}{% trial_ad_banner bar 'client' %}").render(Context({'bar': bar}))

        self.assertIn("Annonce Google", html)
        self.assertIn("adsbygoogle", html)
        self.assertIn("ca-pub-1234567890123456", html)
        self.assertIn('data-ad-slot="1234567890"', html)

    def test_trial_ad_banner_is_hidden_without_active_trial(self):
        bar = Bar.objects.create(nom="Expired Test", abonnement_expire_le=timezone.now() - timezone.timedelta(days=1))

        html = Template("{% load trial_ads %}{% trial_ad_banner bar 'owner' %}").render(Context({'bar': bar}))

        self.assertNotIn("Publicité BarPilote", html)

class AdsTxtTests(TestCase):
    @override_settings(GOOGLE_ADSENSE_CLIENT_ID="ca-pub-1234567890123456")
    def test_ads_txt_exposes_google_adsense_publisher_line(self):
        response = Client().get('/ads.txt')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/plain')
        self.assertContains(response, 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0')
