from django.contrib.auth.models import User
from django.core import signing
from django.test import TestCase
from django.urls import reverse

from client.models import ClientOrderMeta
from proprietaire.models import Bar, Order, PilotProfile, Table


class ClientReleaseTableTests(TestCase):
    def setUp(self):
        self.bar = Bar.objects.create(nom="Client Bar", adresse="Kinshasa")
        self.table = Table.objects.create(bar=self.bar, nom="Table 6")
        self.order = Order.objects.create(bar=self.bar, table=self.table, statut="SERVED")
        self.meta = ClientOrderMeta.objects.create(order=self.order)

    def test_client_cannot_release_table_before_payment(self):
        response = self.client.post(reverse("client_order_action", args=[self.order.id]), {"action": "release_table"})

        self.assertEqual(response.status_code, 400)
        self.meta.refresh_from_db()
        self.assertIsNone(self.meta.table_released_at)

    def test_client_can_release_table_after_payment(self):
        self.order.statut = "PAID"
        self.order.save(update_fields=["statut", "date_maj"])

        response = self.client.post(reverse("client_order_action", args=[self.order.id]), {"action": "release_table"})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["table_released"])
        self.meta.refresh_from_db()
        self.assertIsNotNone(self.meta.table_released_at)


class ClientDebtRequestTests(TestCase):
    def setUp(self):
        self.bar = Bar.objects.create(nom='Client Bar', adresse='Kinshasa')
        self.table = Table.objects.create(bar=self.bar, nom='Table 7')
        self.server_user = User.objects.create_user(username='serveur-test', password='pass')
        self.server_profile = PilotProfile.objects.get(user=self.server_user)
        self.server_profile.bar = self.bar
        self.server_profile.role = 'SERVEUR'
        self.server_profile.prenom = 'Mika'
        self.server_profile.nom = 'Serveur'
        self.server_profile.save(update_fields=['bar', 'role', 'prenom', 'nom'])
        self.order = Order.objects.create(bar=self.bar, table=self.table, serveur=self.server_profile, statut='SERVED')
        self.meta = ClientOrderMeta.objects.create(order=self.order)

    def test_client_can_request_debt(self):
        response = self.client.post(reverse('client_order_action', args=[self.order.id]), {
            'action': 'debt',
            'client_name': 'Jean Doe',
            'client_phone': '+243900000001',
            'client_prenom': 'Jean',
            'client_postnom': 'Doe',
            'debt_due_date': '2026-07-14',
        })

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['debt_status'], 'REQUESTED')
        self.meta.refresh_from_db()
        self.assertTrue(self.meta.debt_requested)
        self.assertEqual(self.meta.debt_status, 'REQUESTED')
        self.assertEqual(self.meta.debt_server_id, self.server_profile.id)


class ServerDebtDecisionTests(TestCase):
    def setUp(self):
        self.bar = Bar.objects.create(nom='Server Bar', adresse='Kinshasa')
        self.table = Table.objects.create(bar=self.bar, nom='Table 8')
        self.server_user = User.objects.create_user(username='serveur-debt', password='pass')
        self.server_profile = PilotProfile.objects.get(user=self.server_user)
        self.server_profile.bar = self.bar
        self.server_profile.role = 'SERVEUR'
        self.server_profile.prenom = 'Nina'
        self.server_profile.nom = 'Serveuse'
        self.server_profile.save(update_fields=['bar', 'role', 'prenom', 'nom'])
        self.order = Order.objects.create(bar=self.bar, table=self.table, serveur=self.server_profile, statut='SERVED')
        self.meta = ClientOrderMeta.objects.create(
            order=self.order,
            debt_requested=True,
            debt_status='REQUESTED',
            debt_server=self.server_profile,
        )

    def _token(self, action):
        payload = {
            'order_id': str(self.order.id),
            'server_id': str(self.server_profile.id),
            'action': action,
            'kind': 'debt',
        }
        return signing.dumps(payload, salt='barpilote-server-order-notification-action')

    def test_server_can_accept_debt(self):
        response = self.client.post(reverse('serveur_order_notification_action') + f'?token={self._token("accept")}')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['status'], 'ACCEPTED')
        self.meta.refresh_from_db()
        self.assertEqual(self.meta.debt_status, 'ACCEPTED')
        self.assertEqual(self.meta.debt_handled_by_id, self.server_profile.id)

    def test_server_can_refuse_debt(self):
        response = self.client.post(reverse('serveur_order_notification_action') + f'?token={self._token("refuse")}')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['status'], 'REFUSED')
        self.meta.refresh_from_db()
        self.assertEqual(self.meta.debt_status, 'REFUSED')
        self.assertEqual(self.meta.debt_handled_by_id, self.server_profile.id)
