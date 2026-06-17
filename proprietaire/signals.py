from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from proprietaire.models import Order
from services.order_realtime import broadcast_order_accepted


@receiver(pre_save, sender=Order)
def remember_previous_order_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return
    instance._previous_status = sender.objects.filter(pk=instance.pk).values_list('statut', flat=True).first()


@receiver(post_save, sender=Order)
def notify_order_acceptance(sender, instance, created, **kwargs):
    # Distribution unique: on notifie seulement au passage vers ACCEPTEE.
    if created:
        return
    if getattr(instance, '_previous_status', None) == instance.statut:
        return
    if instance.statut == 'ACCEPTEE':
        broadcast_order_accepted(instance)
