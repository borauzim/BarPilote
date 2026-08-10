from datetime import datetime
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from proprietaire.models import Bar, Order, PilotProfile, Table
from serveur.models import ServeurProfile


class ServerFinancePeriodTests(TestCase):
    def test_server_can_filter_only_own_finances_between_two_dates(self):
        owner = User.objects.create_user(username='period-owner')
        server = User.objects.create_user(username='period-server')
        colleague = User.objects.create_user(username='period-colleague')
        bar = Bar.objects.create(nom='Period Bar', adresse='Kinshasa')
        PilotProfile.objects.filter(user=owner).update(role='PROPRIETAIRE', bar=bar)
        PilotProfile.objects.filter(user=server).update(role='SERVEUR', bar=bar)
        PilotProfile.objects.filter(user=colleague).update(role='SERVEUR', bar=bar)
        server_pilot = PilotProfile.objects.get(user=server)
        colleague_pilot = PilotProfile.objects.get(user=colleague)
        ServeurProfile.objects.create(user=server, nom='Serveur', prenom='Un', email='period-server@example.com', bar=bar, confirmation_status='CONFIRMED')
        ServeurProfile.objects.create(user=colleague, nom='Serveur', prenom='Deux', email='period-colleague@example.com', bar=bar, confirmation_status='CONFIRMED')
        table = Table.objects.create(bar=bar, nom='Table période')

        own_inside = Order.objects.create(bar=bar, table=table, serveur=server_pilot, statut='PAID', total_cdf=Decimal('50000'))
        own_outside = Order.objects.create(bar=bar, table=table, serveur=server_pilot, statut='PAID', total_cdf=Decimal('90000'))
        colleague_inside = Order.objects.create(bar=bar, table=table, serveur=colleague_pilot, statut='PAID', total_cdf=Decimal('70000'))
        tz = timezone.get_current_timezone()
        Order.objects.filter(pk=own_inside.pk).update(date_creation=timezone.make_aware(datetime(2026, 1, 10), tz))
        Order.objects.filter(pk=own_outside.pk).update(date_creation=timezone.make_aware(datetime(2024, 1, 10), tz))
        Order.objects.filter(pk=colleague_inside.pk).update(date_creation=timezone.make_aware(datetime(2026, 1, 10), tz))

        self.client.force_login(server)
        response = self.client.get(reverse('serveur_finance'), {
            'start_date': '2025-05-15', 'end_date': '2026-07-11',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['total_orders'], 1)
        self.assertEqual(response.context['revenue_cdf'], Decimal('50000'))
        self.assertEqual(response.context['start_date'], '2025-05-15')
        self.assertEqual(response.context['end_date'], '2026-07-11')
        self.assertContains(response, 'Afficher la période')
