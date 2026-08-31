from django.db import models
from django.db.models import Q
from django.utils import timezone

from proprietaire.models import Facture, Order, PilotProfile, Table


class TableSession(models.Model):
    STATUS_CHOICES = [
        ('OPEN', 'Ouverte'),
        ('PAID', 'Payée'),
        ('CLOSED', 'Libérée'),
    ]

    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name='client_sessions')
    facture = models.OneToOneField(Facture, on_delete=models.SET_NULL, null=True, blank=True, related_name='table_session')
    statut = models.CharField(max_length=10, choices=STATUS_CHOICES, default='OPEN')
    opened_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    order_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-opened_at']
        constraints = [
            models.UniqueConstraint(fields=['table'], condition=Q(statut__in=['OPEN', 'PAID']), name='unique_active_session_per_table'),
        ]


class TableParticipant(models.Model):
    table_session = models.ForeignKey(TableSession, on_delete=models.CASCADE, related_name='participants')
    session_key = models.CharField(max_length=80)
    joined_at = models.DateTimeField(auto_now_add=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['table_session', 'session_key'], name='unique_table_session_participant'),
        ]


class ClientOrderMeta(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='client_meta')
    session_key = models.CharField(max_length=80, blank=True)
    table_session = models.ForeignKey(TableSession, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_metas')
    participant = models.ForeignKey(TableParticipant, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_metas')
    client_postnom = models.CharField(max_length=120, blank=True)
    client_prenom = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.CharField(max_length=20, blank=True)
    debt_requested = models.BooleanField(default=False)
    debt_requested_at = models.DateTimeField(null=True, blank=True)
    debt_due_date = models.DateField(null=True, blank=True)
    debt_server = models.ForeignKey(PilotProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='client_debt_requests')
    debt_reason = models.TextField(blank=True)
    debt_status = models.CharField(max_length=20, default='NONE', blank=True)
    debt_handled_at = models.DateTimeField(null=True, blank=True)
    debt_handled_by = models.ForeignKey(PilotProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='handled_client_debts')
    debt_response_reason = models.TextField(blank=True)
    payment_requested = models.BooleanField(default=False)
    payment_requested_at = models.DateTimeField(null=True, blank=True)
    payment_currency = models.CharField(max_length=3, choices=[('USD', 'USD ($)'), ('CDF', 'CDF (FC)')], default='CDF')
    payment_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    payment_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_confirmed_by = models.ForeignKey(PilotProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='confirmed_client_payments')
    payment_confirmed_at = models.DateTimeField(null=True, blank=True)
    server_call_status = models.CharField(max_length=20, default='NONE', blank=True)
    server_call_requested_at = models.DateTimeField(null=True, blank=True)
    server_call_responded_at = models.DateTimeField(null=True, blank=True)
    server_call_responded_by = models.ForeignKey(PilotProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='handled_client_calls')
    repeat_after_minutes = models.PositiveIntegerField(null=True, blank=True)
    repeat_source = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='client_repeats')
    table_released_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def has_payment_request(self):
        return self.payment_requested and not self.payment_confirmed_at

    def mark_payment_requested(self):
        self.payment_requested = True
        self.payment_requested_at = timezone.now()
        self.save(update_fields=['payment_requested', 'payment_requested_at', 'updated_at'])


class ClientServiceRating(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='client_rating')
    server = models.ForeignKey(PilotProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='client_server_ratings')
    server_score = models.PositiveSmallIntegerField(null=True, blank=True)
    bar_score = models.PositiveSmallIntegerField(null=True, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


def mark_table_session_paid(order, confirmed_by=None):
    """Clôture toutes les commandes et la facture de la session de table."""
    from decimal import Decimal

    try:
        meta = order.client_meta
    except ClientOrderMeta.DoesNotExist:
        return [order]
    table_session = meta.table_session
    if table_session is None:
        return [order]

    now = timezone.now()
    orders = list(Order.objects.filter(client_meta__table_session=table_session).exclude(statut='CANCELLED').distinct())
    for shared_order in orders:
        if shared_order.statut != 'PAID':
            shared_order.statut = 'PAID'
            shared_order.save(update_fields=['statut', 'date_maj'])
    updates = {'payment_requested': False, 'payment_confirmed_at': now, 'updated_at': now}
    if confirmed_by is not None:
        updates['payment_confirmed_by'] = confirmed_by
    ClientOrderMeta.objects.filter(order__in=orders).update(**updates)
    table_session.statut = 'PAID'
    table_session.paid_at = now
    table_session.save(update_fields=['statut', 'paid_at'])
    facture = table_session.facture
    if facture:
        facture.montant_usd = sum((item.total_usd for item in orders), Decimal('0'))
        facture.montant_cdf = sum((item.total_cdf for item in orders), Decimal('0'))
        facture.statut = 'PAYEE'
        facture.date_paiement = now
        facture.save(update_fields=['montant_usd', 'montant_cdf', 'statut', 'date_paiement'])
        facture.orders.set(orders)
    return orders
