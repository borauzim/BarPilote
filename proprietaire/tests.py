from decimal import Decimal

from django.contrib.auth.models import User
from django.template import Context, Template
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .models import Bar, PilotProfile, Table


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


class EstablishmentDetailsTests(TestCase):
    def test_owner_cannot_set_monthly_price_from_setup_form(self):
        user = User.objects.create_user(username='owner-price', email='owner-price@example.com', password='pass')
        profile, _ = PilotProfile.objects.get_or_create(user=user)
        profile.role = 'PROPRIETAIRE'
        profile.save(update_fields=['role'])
        client = Client()
        client.force_login(user)
        session = client.session
        session['setup_bar_type'] = 'BAR'
        session.save()

        response = client.post('/proprietaire/setup-bar/details/', {
            'name': 'Prix Verrouille',
            'address': 'Kinshasa',
            'monthly_price_per_table_usd': '999.99',
        })

        self.assertEqual(response.status_code, 302)
        bar = Bar.objects.get(nom='Prix Verrouille')
        self.assertEqual(bar.prix_mensuel_par_table_usd, Decimal('2.50'))


class ProfileSetupEditTests(TestCase):
    def test_owner_can_update_profile_after_onboarding(self):
        user = User.objects.create_user(username='owner-edit', email='owner-edit@example.com', password='pass')
        bar = Bar.objects.create(nom='Profil Bar')
        profile, _ = PilotProfile.objects.get_or_create(user=user)
        profile.role = 'PROPRIETAIRE'
        profile.bar = bar
        profile.nom = 'ANCIEN'
        profile.prenom = 'Ancien'
        profile.telephone = '+243810000000'
        profile.save(update_fields=['role', 'bar', 'nom', 'prenom', 'telephone'])
        profile.owned_bars.add(bar)
        client = Client()
        client.force_login(user)

        response = client.post('/proprietaire/profile-setup/', {
            'prenom': 'Jean',
            'nom': 'Kabila',
            'postnom': 'Mwanza',
            'sexe': 'M',
            'telephone': '+243812345678',
        })

        self.assertRedirects(response, '/proprietaire/dashboard/')
        profile.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(profile.prenom, 'Jean')
        self.assertEqual(profile.nom, 'KABILA')
        self.assertEqual(profile.postnom, 'MWANZA')
        self.assertEqual(profile.telephone, '+243812345678')
        self.assertEqual(user.first_name, 'Jean')
        self.assertEqual(user.last_name, 'KABILA')


class TableSubscriptionSelectionTests(TestCase):
    def test_owner_selects_tables_and_server_calculates_subscription_total(self):
        user = User.objects.create_user(username='owner-subscription', email='owner-subscription@example.com', password='pass')
        profile, _ = PilotProfile.objects.get_or_create(user=user)
        profile.role = 'PROPRIETAIRE'
        bar = Bar.objects.create(nom='Selection Bar', prix_mensuel_par_table_usd=Decimal('3.25'))
        profile.bar = bar
        profile.save(update_fields=['role', 'bar'])
        profile.owned_bars.add(bar)
        table_1 = Table.objects.create(bar=bar, nom='Table 1', est_active=False)
        table_2 = Table.objects.create(bar=bar, nom='Table 2', est_active=False)
        table_3 = Table.objects.create(bar=bar, nom='Table 3', est_active=False)
        client = Client()
        client.force_login(user)

        response = client.post('/proprietaire/tables/action/', {
            'action': 'activate_subscriptions_bulk',
            'table_ids': [str(table_1.id), str(table_3.id)],
            'days': '30',
        }, HTTP_ACCEPT='application/json')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['dispatch_event']['detail']['selected_count'], 2)
        self.assertEqual(Decimal(str(payload['dispatch_event']['detail']['final_price_usd'])), Decimal('6.5'))
        table_1.refresh_from_db()
        table_2.refresh_from_db()
        table_3.refresh_from_db()
        self.assertTrue(table_1.subscription_is_active)
        self.assertFalse(table_2.subscription_is_active)
        self.assertTrue(table_3.subscription_is_active)
