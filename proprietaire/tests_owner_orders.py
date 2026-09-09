from decimal import Decimal
from unittest.mock import patch
import json

from django.contrib.auth.models import User
from django.test import TestCase, RequestFactory
from django.utils import timezone

from client.models import ClientOrderMeta, TableSession
from client.views import _facture_for_order
from proprietaire.html_views import LiveOrdersAPIView, UpdateOrderStatusView
from proprietaire.models import Bar, Table, Order, Facture


class OwnerOrderWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='owner-workflow')
        self.bar = Bar.objects.create(nom='Bar workflow')
        self.profile = self.user.pilot_profile
        self.profile.role = 'PROPRIETAIRE'
        self.profile.bar = self.bar
        self.profile.save()
        self.table = Table.objects.create(bar=self.bar, nom='Table 1')
        self.factory = RequestFactory()
        self.status_notify = patch('proprietaire.html_views.notify_order_status').start()
        self.debt_notify = patch('proprietaire.html_views.notify_debt_created').start()
        self.addCleanup(patch.stopall)

    def order(self, status='PENDING', **kwargs):
        return Order.objects.create(bar=self.bar, table=self.table, statut=status, total_usd=Decimal('10'), **kwargs)

    def post(self, orders, status, **extra):
        request = self.factory.post('/proprietaire/api/update-order-status/', {
            'order_id': ','.join(str(order.pk) for order in orders), 'status': status, **extra,
        })
        request.user = self.user
        return UpdateOrderStatusView.as_view()(request)

    def test_full_workflow_and_duplicate_cash(self):
        order = self.order()
        for status in ['ACCEPTEE', 'PREPARING', 'SERVED', 'PAID']:
            response = self.post([order], status)
            self.assertEqual(response.status_code, 200, response.content)
            order.refresh_from_db()
            self.assertEqual(order.statut, status)
        self.assertIsNotNone(order.date_service)
        self.assertIsNotNone(order.stock_deducted_at)
        self.assertIsNotNone(order.client_meta.payment_confirmed_at)
        self.assertEqual(order.factures.get().statut, 'PAYEE')
        self.assertEqual(self.post([order], 'PAID').status_code, 409)
        self.assertEqual(order.factures.count(), 1)

    def test_refusal_is_terminal_without_invoice(self):
        order = self.order()
        self.assertEqual(self.post([order], 'CANCELLED').status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.statut, 'CANCELLED')
        self.assertEqual(order.client_meta.cancelled_by, 'PROPRIETAIRE')
        self.assertFalse(order.factures.exists())
        self.assertEqual(self.post([order], 'ACCEPTEE').status_code, 409)

    def test_debt_is_not_cash_even_after_client_reads_invoice(self):
        order = self.order('SERVED')
        invoice = _facture_for_order(order)
        response = self.post([order], 'PAID', deferred='true', guarantor='proprietaire', client_name='Jean')
        self.assertEqual(response.status_code, 200, response.content)
        order.refresh_from_db()
        meta = ClientOrderMeta.objects.get(order=order)
        self.assertEqual(meta.debt_status, 'ACCEPTED')
        self.assertIsNone(meta.payment_confirmed_at)
        self.assertFalse(meta.payment_requested)
        invoice.refresh_from_db()
        self.assertEqual(invoice.statut, 'IMPAYEE')
        self.assertEqual(invoice.guaranteed_by, self.profile)
        self.assertEqual(_facture_for_order(order).statut, 'IMPAYEE')
        self.assertEqual(order.factures.count(), 1)
        self.debt_notify.assert_called_once()

    def test_debt_requires_eligibility_or_guarantor(self):
        order = self.order('SERVED')
        self.assertEqual(self.post([order], 'PAID', deferred='true').status_code, 403)
        order.refresh_from_db()
        self.assertEqual(order.statut, 'SERVED')
        self.assertFalse(order.factures.exists())

    def test_group_with_invalid_stage_is_unchanged(self):
        accepted = self.order('ACCEPTEE')
        pending = self.order()
        self.assertEqual(self.post([accepted, pending], 'PREPARING').status_code, 409)
        accepted.refresh_from_db()
        self.assertEqual(accepted.statut, 'ACCEPTEE')
        self.assertEqual(self.post([pending], 'PAID').status_code, 409)

    def test_foreign_bar_order_cannot_be_changed(self):
        other_bar = Bar.objects.create(nom='Other bar')
        other_table = Table.objects.create(bar=other_bar, nom='Other table')
        foreign = Order.objects.create(bar=other_bar, table=other_table)
        local = self.order()
        self.assertEqual(self.post([local, foreign], 'ACCEPTEE').status_code, 404)
        local.refresh_from_db()
        self.assertEqual(local.statut, 'PENDING')

    def test_open_orders_from_yesterday_stay_visible(self):
        order = self.order('ACCEPTEE')
        Order.objects.filter(pk=order.pk).update(date_creation=timezone.now() - timezone.timedelta(days=1))
        request = self.factory.get('/proprietaire/api/live-orders/')
        request.user = self.user
        data = json.loads(LiveOrdersAPIView.as_view()(request).content)
        self.assertIn(str(order.pk), [item['id'] for item in data['orders']])

    def test_shared_invoice_is_reused_and_session_paid(self):
        orders = [self.order('SERVED'), self.order('SERVED')]
        session = TableSession.objects.create(table=self.table, order_sent_at=timezone.now())
        for order in orders:
            ClientOrderMeta.objects.create(order=order, table_session=session)
        invoice = _facture_for_order(orders[0])
        self.assertEqual(self.post(orders, 'PAID').status_code, 200)
        invoice.refresh_from_db()
        session.refresh_from_db()
        self.assertEqual(invoice.statut, 'PAYEE')
        self.assertEqual(invoice.montant_usd, Decimal('20'))
        self.assertEqual(session.statut, 'PAID')
        self.assertEqual(Facture.objects.filter(bar=self.bar).count(), 1)

    def test_shared_invoice_cannot_pay_unserved_round(self):
        served = self.order('SERVED')
        pending = self.order()
        session = TableSession.objects.create(table=self.table, order_sent_at=timezone.now())
        for order in [served, pending]:
            ClientOrderMeta.objects.create(order=order, table_session=session)
        _facture_for_order(served)
        self.assertEqual(self.post([served], 'PAID').status_code, 409)
        served.refresh_from_db()
        pending.refresh_from_db()
        self.assertEqual(served.statut, 'SERVED')
        self.assertEqual(pending.statut, 'PENDING')

    def test_shared_debt_stays_unpaid_after_client_refresh(self):
        orders = [self.order('SERVED'), self.order('SERVED')]
        session = TableSession.objects.create(table=self.table, order_sent_at=timezone.now())
        for order in orders:
            ClientOrderMeta.objects.create(order=order, table_session=session)
        invoice = _facture_for_order(orders[0])
        response = self.post(orders, 'PAID', deferred='true', guarantor='proprietaire')
        self.assertEqual(response.status_code, 200, response.content)
        orders[0].refresh_from_db()
        self.assertEqual(_facture_for_order(orders[0]).statut, 'IMPAYEE')
        self.assertFalse(ClientOrderMeta.objects.filter(order__in=orders, payment_confirmed_at__isnull=False).exists())
        invoice.refresh_from_db()
        self.assertEqual(invoice.montant_usd, Decimal('20'))

    def test_failed_invoice_rolls_back_order_and_payment(self):
        order = self.order('SERVED')
        with patch('proprietaire.html_views.Facture.objects.create', side_effect=RuntimeError('invoice failed')):
            with self.assertRaises(RuntimeError):
                self.post([order], 'PAID')
        order.refresh_from_db()
        self.assertEqual(order.statut, 'SERVED')
        self.assertIsNone(order.stock_deducted_at)
        self.assertFalse(ClientOrderMeta.objects.filter(order=order).exists())

    def test_server_guarantee_uses_assigned_server(self):
        server = User.objects.create_user(username='guarantor').pilot_profile
        server.role = 'SERVEUR'
        server.bar = self.bar
        server.save()
        order = self.order('SERVED', serveur=server)
        response = self.post([order], 'PAID', deferred='true', guarantor='serveur')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(order.factures.get().guaranteed_by, server)
