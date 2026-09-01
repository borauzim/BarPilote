from decimal import Decimal
from unittest.mock import patch

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


class TableCreationTests(TestCase):
    def test_native_mobile_form_adds_tables_and_redirects(self):
        user = User.objects.create_user(username='owner-mobile-tables', email='owner-mobile@example.com', password='pass')
        bar = Bar.objects.create(nom='Mobile Tables Bar')
        profile, _ = PilotProfile.objects.get_or_create(user=user)
        profile.role = 'PROPRIETAIRE'
        profile.bar = bar
        profile.save(update_fields=['role', 'bar'])
        client = Client()
        client.force_login(user)

        response = client.post('/proprietaire/tables/action/', {'action': 'add', 'count': '3'})

        self.assertRedirects(response, '/proprietaire/tables/')
        self.assertEqual(Table.objects.filter(bar=bar).count(), 3)

    @patch('proprietaire.html_views.notify_bar_servers', side_effect=RuntimeError('notification unavailable'))
    def test_notification_failure_does_not_fail_table_creation(self, _notify):
        user = User.objects.create_user(username='owner-notify-tables', email='owner-notify@example.com', password='pass')
        bar = Bar.objects.create(nom='Notification Tables Bar')
        profile, _ = PilotProfile.objects.get_or_create(user=user)
        profile.role = 'PROPRIETAIRE'
        profile.bar = bar
        profile.save(update_fields=['role', 'bar'])
        client = Client()
        client.force_login(user)

        response = client.post('/proprietaire/tables/action/', {
            'action': 'add',
            'count': '1',
        }, HTTP_X_REQUESTED_WITH='XMLHttpRequest', HTTP_ACCEPT='application/json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertTrue(Table.objects.filter(bar=bar, nom='Table 1').exists())

    def test_live_add_creates_tables_and_refreshes_table_list(self):
        user = User.objects.create_user(username='owner-tables', email='owner-tables@example.com', password='pass')
        bar = Bar.objects.create(nom='Tables Bar')
        profile, _ = PilotProfile.objects.get_or_create(user=user)
        profile.role = 'PROPRIETAIRE'
        profile.bar = bar
        profile.save(update_fields=['role', 'bar'])
        profile.owned_bars.add(bar)
        client = Client()
        client.force_login(user)

        response = client.post('/proprietaire/tables/action/', {
            'action': 'add',
            'count': '2',
        }, HTTP_X_REQUESTED_WITH='XMLHttpRequest', HTTP_ACCEPT='application/json')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertNotIn('redirect_url', payload)
        self.assertEqual(payload['close_selector'], '#addTablesModal')
        self.assertEqual(payload['dispatch_event']['detail']['action'], 'add')
        self.assertEqual(Table.objects.filter(bar=bar).count(), 2)
        self.assertTrue(Table.objects.filter(bar=bar, nom='Table 1').exists())
        self.assertTrue(Table.objects.filter(bar=bar, nom='Table 2').exists())

    def test_owner_can_add_tables_after_deleting_one(self):
        user = User.objects.create_user(username='owner-readd-tables', email='owner-readd@example.com', password='pass')
        bar = Bar.objects.create(nom='Readd Tables Bar')
        profile, _ = PilotProfile.objects.get_or_create(user=user)
        profile.role = 'PROPRIETAIRE'
        profile.bar = bar
        profile.save(update_fields=['role', 'bar'])
        profile.owned_bars.add(bar)
        Table.objects.create(bar=bar, nom='Table 1')
        deleted_table = Table.objects.create(bar=bar, nom='Table 2')
        client = Client()
        client.force_login(user)

        delete_response = client.post('/proprietaire/tables/action/', {
            'action': 'delete',
            'table_id': str(deleted_table.id),
        }, HTTP_X_REQUESTED_WITH='XMLHttpRequest', HTTP_ACCEPT='application/json')
        self.assertTrue(delete_response.json()['success'])

        add_response = client.post('/proprietaire/tables/action/', {
            'action': 'add',
            'count': '2',
        }, HTTP_X_REQUESTED_WITH='XMLHttpRequest', HTTP_ACCEPT='application/json')

        self.assertEqual(add_response.status_code, 200)
        self.assertTrue(add_response.json()['success'])
        self.assertEqual(
            list(Table.objects.filter(bar=bar).order_by('nom').values_list('nom', flat=True)),
            ['Table 1', 'Table 2', 'Table 3'],
        )
