from django.db import models
from django.utils import timezone

from proprietaire.models import Order, PilotProfile


class ClientOrderMeta(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='client_meta')
    session_key = models.CharField(max_length=80, blank=True)
    client_postnom = models.CharField(max_length=120, blank=True)
    client_prenom = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.CharField(max_length=20, blank=True)
    debt_requested = models.BooleanField(default=False)
    debt_reason = models.TextField(blank=True)
    payment_requested = models.BooleanField(default=False)
    payment_requested_at = models.DateTimeField(null=True, blank=True)
    payment_currency = models.CharField(max_length=3, choices=[('USD', 'USD ($)'), ('CDF', 'CDF (FC)')], default='CDF')
    payment_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    payment_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_confirmed_by = models.ForeignKey(PilotProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='confirmed_client_payments')
    payment_confirmed_at = models.DateTimeField(null=True, blank=True)
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
