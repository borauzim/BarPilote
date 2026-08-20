from django.contrib.auth.models import User
from django.core import signing
from django.test import Client as DjangoClient, TestCase
from django.urls import reverse
from django.utils import timezone
from unittest.mock import patch
from datetime import timedelta

from client.models import ClientOrderMeta, TableParticipant, TableSession, mark_table_session_paid
from client.views import _finalize_group_order
from proprietaire.models import Bar, Category, Facture, MasterProduct, Order, OrderItem, PilotProfile, StockItem, Table


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


class SharedTableBillTests(TestCase):
    def setUp(self):
        self.bar = Bar.objects.create(nom='Groupe Bar', adresse='Kinshasa')
        self.table = Table.objects.create(
            bar=self.bar, nom='Table 4',
            subscription_started_at=timezone.now(),
            subscription_expires_at=timezone.now() + timedelta(days=30),
        )
        self.phone_one = DjangoClient()
        self.phone_two = DjangoClient()
        session_one = self.phone_one.session
        session_one['joined'] = True
        session_one.save()
        session_two = self.phone_two.session
        session_two['joined'] = True
        session_two.save()
        self.table_session = TableSession.objects.create(table=self.table)
        self.participant_one = TableParticipant.objects.create(table_session=self.table_session, session_key=session_one.session_key)
        self.participant_two = TableParticipant.objects.create(table_session=self.table_session, session_key=session_two.session_key)
        self.order_one = Order.objects.create(bar=self.bar, table=self.table, statut='SERVED', total_usd=2)
        self.order_two = Order.objects.create(bar=self.bar, table=self.table, statut='SERVED', total_usd=3)
        ClientOrderMeta.objects.create(order=self.order_one, session_key=session_one.session_key, table_session=self.table_session, participant=self.participant_one)
        ClientOrderMeta.objects.create(order=self.order_two, session_key=session_two.session_key, table_session=self.table_session, participant=self.participant_two)
        self.facture = Facture.objects.create(
            bar=self.bar, numero='FAC-TABLE-4', client_fournisseur='Addition partagée - Table 4',
            montant_usd=5, type_facture='CLIENT', statut='IMPAYEE',
        )
        self.facture.orders.set([self.order_one, self.order_two])
        self.table_session.facture = self.facture
        self.table_session.save(update_fields=['facture'])

    def test_payment_is_shared_and_invoice_is_in_both_histories(self):
        mark_table_session_paid(self.order_one)
        self.order_one.refresh_from_db()
        self.order_two.refresh_from_db()
        self.facture.refresh_from_db()
        self.table_session.refresh_from_db()
        self.assertEqual(self.order_one.statut, 'PAID')
        self.assertEqual(self.order_two.statut, 'PAID')
        self.assertEqual(self.facture.statut, 'PAYEE')
        self.assertEqual(self.table_session.statut, 'PAID')
        for phone in (self.phone_one, self.phone_two):
            response = phone.get(reverse('client_invoices', args=[self.table.id]))
            self.assertContains(response, 'FAC-TABLE-4')

    def test_table_closes_only_after_every_participant_releases(self):
        mark_table_session_paid(self.order_one)
        first = self.phone_one.post(reverse('client_order_action', args=[self.order_one.id]), {'action': 'release_table'})
        self.assertEqual(first.status_code, 200)
        self.assertFalse(first.json()['table_fully_released'])
        self.table_session.refresh_from_db()
        self.assertEqual(self.table_session.statut, 'PAID')
        second = self.phone_two.post(reverse('client_order_action', args=[self.order_two.id]), {'action': 'release_table'})
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.json()['table_fully_released'])

    def test_new_order_after_payment_redirects_to_status(self):
        category = Category.objects.create(nom='Nouvelle tournée')
        product = MasterProduct.objects.create(nom='Produit tournée', categorie=category)
        stock = StockItem.objects.create(
            bar=self.bar, produit=product, prix_vente_unitaire=2, quantite_actuelle=20,
        )
        mark_table_session_paid(self.order_one)

        menu_response = self.phone_one.get(reverse('client_menu', args=[self.table.id]))
        response = self.phone_one.post(
            reverse('client_menu', args=[self.table.id]),
            {f'qty_{stock.id}': '1', f'unit_{stock.id}': 'BOUTEILLE'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
            HTTP_ACCEPT='application/json',
        )

        self.assertEqual(menu_response.status_code, 200)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.table_session.refresh_from_db()
        self.assertEqual(self.table_session.statut, 'CLOSED')


class GroupOrderDispatchTests(TestCase):
    def setUp(self):
        self.bar = Bar.objects.create(nom='Envoi Groupe', adresse='Kinshasa')
        self.table = Table.objects.create(bar=self.bar, nom='Table 4')
        self.table_session = TableSession.objects.create(table=self.table)
        category = Category.objects.create(nom='Boissons groupe')
        soda = MasterProduct.objects.create(nom='Soda groupe', categorie=category)
        beer = MasterProduct.objects.create(nom='Bière groupe', categorie=category)
        self.soda_stock = StockItem.objects.create(bar=self.bar, produit=soda, prix_vente_unitaire=2, quantite_actuelle=20)
        self.beer_stock = StockItem.objects.create(bar=self.bar, produit=beer, prix_vente_unitaire=3, quantite_actuelle=20)

    def _draft(self, session_key, stock_item, ready=True):
        participant = TableParticipant.objects.create(table_session=self.table_session, session_key=session_key, ready_at=timezone.now() if ready else None)
        order = Order.objects.create(bar=self.bar, table=self.table, statut='DRAFT')
        ClientOrderMeta.objects.create(order=order, session_key=session_key, table_session=self.table_session, participant=participant)
        OrderItem.objects.create(order=order, product_item=stock_item, quantite=1, prix_unitaire=stock_item.prix_vente_unitaire, devise='USD')
        return order

    def test_order_waits_until_every_scanned_phone_is_ready(self):
        self._draft('phone-one', self.soda_stock)
        self._draft('phone-two', self.beer_stock, ready=False)
        with patch('client.views._notify_assignment') as notify:
            master, phones, ready, sent = _finalize_group_order(self.table_session)
        self.assertIsNone(master)
        self.assertEqual((phones, ready), (2, 1))
        self.assertFalse(sent)
        self.assertEqual(Order.objects.filter(client_meta__table_session=self.table_session, statut='PENDING').count(), 0)
        notify.assert_not_called()

    def test_all_ready_phones_generate_one_server_order_and_one_notification(self):
        self._draft('phone-one', self.soda_stock)
        self._draft('phone-two', self.beer_stock)
        with patch('client.views._notify_assignment') as notify:
            with self.captureOnCommitCallbacks(execute=True):
                master, phones, ready, sent = _finalize_group_order(self.table_session)
            self.assertTrue(sent)
            self.assertEqual((phones, ready), (2, 2))
            self.assertEqual(master.statut, 'PENDING')
            self.assertEqual(Order.objects.filter(client_meta__table_session=self.table_session, statut='PENDING').count(), 1)
            self.assertEqual(Order.objects.filter(client_meta__table_session=self.table_session, statut='DRAFT').count(), 1)
            self.assertEqual(set(master.items.values_list('product_item_id', flat=True)), {self.soda_stock.id, self.beer_stock.id})
            notify.assert_called_once()
            with self.captureOnCommitCallbacks(execute=True):
                same_master, _phones, _ready, sent_again = _finalize_group_order(self.table_session)
            self.assertFalse(sent_again)
            self.assertEqual(same_master.id, master.id)
            notify.assert_called_once()
