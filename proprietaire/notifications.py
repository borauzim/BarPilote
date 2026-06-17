from django.contrib.auth.models import User
from django.db import IntegrityError
from django.urls import reverse
from django.utils import timezone

from .models import Facture, Notification, PilotProfile
from services.notifications import send_bar_notification


def notify_user(user, *, title, message='', category='SYSTEM', bar=None, actor=None, url='', dedupe_key=None):
    if not user or not getattr(user, 'is_authenticated', False):
        return None

    payload = {
        'recipient': user,
        'bar': bar,
        'actor': actor if actor != user else None,
        'category': category,
        'title': title,
        'message': message,
        'url': url,
    }
    if dedupe_key:
        payload['dedupe_key'] = dedupe_key

    if dedupe_key and Notification.objects.filter(dedupe_key=dedupe_key).exists():
        return Notification.objects.filter(dedupe_key=dedupe_key).first()

    result = send_bar_notification(
        user.id,
        title,
        message,
        {
            'category': category,
            'url': url,
            'bar_id': str(bar.id) if bar else '',
            'actor_id': str(actor.id) if actor else '',
        },
    )
    notification_id = result.get('notification_id')
    if notification_id and dedupe_key:
        Notification.objects.filter(id=notification_id).update(dedupe_key=dedupe_key)
    return Notification.objects.filter(id=notification_id).first() if notification_id else None


def notify_profiles(profiles, **kwargs):
    seen = set()
    created = []
    for profile in profiles:
        user = getattr(profile, 'user', None)
        if not user or user.id in seen:
            continue
        seen.add(user.id)
        item = notify_user(user, **kwargs)
        if item:
            created.append(item)
    return created


def owner_profiles_for_bar(bar):
    if not bar:
        return PilotProfile.objects.none()
    return PilotProfile.objects.filter(bar=bar, role='PROPRIETAIRE').select_related('user')


def server_profiles_for_bar(bar):
    if not bar:
        return PilotProfile.objects.none()
    return PilotProfile.objects.filter(bar=bar, role='SERVEUR').select_related('user')


def notify_bar_owners(bar, **kwargs):
    return notify_profiles(owner_profiles_for_bar(bar), bar=bar, **kwargs)


def notify_bar_servers(bar, **kwargs):
    return notify_profiles(server_profiles_for_bar(bar), bar=bar, **kwargs)


def notify_order_created(order, *, actor=None):
    server_name = 'Non assigné'
    if order.serveur:
        server_name = f'{order.serveur.prenom} {order.serveur.nom}'.strip() or server_name
    url = reverse('dashboard_html')
    notify_bar_owners(
        order.bar,
        actor=actor,
        category='ORDER',
        title=f'Nouvelle commande - {order.table.nom}',
        message=f'{server_name} a enregistré une commande pour {order.table.nom}.',
        url=url,
    )
    if order.serveur and order.serveur.user_id != getattr(actor, 'id', None):
        notify_user(
            order.serveur.user,
            actor=actor,
            bar=order.bar,
            category='ORDER',
            title=f'Commande créée - {order.table.nom}',
            message='La commande est visible dans votre tableau de bord.',
            url=reverse('serveur_dashboard'),
        )


def notify_order_status(order, *, actor=None, status_label=None):
    label = status_label or order.get_statut_display()
    notify_bar_owners(
        order.bar,
        actor=actor,
        category='ORDER',
        title=f'Commande {label.lower()} - {order.table.nom}',
        message=f'Le ticket #{order.id.hex[:6].upper()} est maintenant {label.lower()}.',
        url=reverse('dashboard_html'),
    )
    if order.serveur and order.serveur.user_id != getattr(actor, 'id', None):
        notify_user(
            order.serveur.user,
            actor=actor,
            bar=order.bar,
            category='ORDER',
            title=f'Commande {label.lower()} - {order.table.nom}',
            message=f'Le ticket #{order.id.hex[:6].upper()} a changé de statut.',
            url=reverse('serveur_dashboard'),
        )


def notify_debt_created(facture, *, actor=None):
    title = f'Dette à payer - {facture.client_fournisseur}'
    message = f'Facture {facture.numero} enregistrée comme impayée.'
    notify_bar_owners(facture.bar, actor=actor, category='DEBT', title=title, message=message, url=reverse('finance_html'))

    server_profiles = PilotProfile.objects.filter(bar=facture.bar, role='SERVEUR', orders__factures=facture).select_related('user').distinct()
    if facture.guaranteed_by_id:
        server_profiles = (server_profiles | PilotProfile.objects.filter(id=facture.guaranteed_by_id).select_related('user')).distinct()
    for profile in server_profiles:
        notify_user(profile.user, actor=actor, bar=facture.bar, category='DEBT', title=title, message=message, url=reverse('serveur_finance'))


def ensure_daily_debt_reminders(user):
    today = timezone.localdate().isoformat()
    profile = PilotProfile.objects.filter(user=user).select_related('bar').first()
    if not profile or not profile.bar:
        return

    if profile.role == 'PROPRIETAIRE':
        factures = Facture.objects.filter(bar=profile.bar, type_facture='CLIENT', statut='IMPAYEE')
        url = reverse('finance_html')
    else:
        served_facture_ids = Facture.objects.filter(
            bar=profile.bar,
            type_facture='CLIENT',
            statut='IMPAYEE',
            orders__serveur=profile,
        ).values_list('id', flat=True)
        guaranteed_facture_ids = Facture.objects.filter(
            bar=profile.bar,
            type_facture='CLIENT',
            statut='IMPAYEE',
            guaranteed_by=profile,
        ).values_list('id', flat=True)
        factures = Facture.objects.filter(id__in=set(served_facture_ids) | set(guaranteed_facture_ids))
        url = reverse('serveur_finance')

    for facture in factures[:20]:
        notify_user(
            user,
            bar=profile.bar,
            category='DEBT',
            title=f'Rappel dette - {facture.client_fournisseur}',
            message=f'La facture {facture.numero} est toujours impayée.',
            url=url,
            dedupe_key=f'debt-reminder:{user.id}:{facture.id}:{today}',
        )
