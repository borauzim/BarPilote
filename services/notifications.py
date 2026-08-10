import json
import logging
import os

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from firebase_admin import credentials, initialize_app, messaging
from firebase_admin import get_app
from firebase_admin.exceptions import FirebaseError

from proprietaire.models import FCMDeviceToken, Notification
from services.consumers import is_user_ws_online, user_group_name

logger = logging.getLogger(__name__)
_firebase_initialized = False
_firebase_unavailable = False


def _firebase_app():
    """Initialise Firebase Admin une seule fois depuis les variables d'environnement."""
    global _firebase_initialized, _firebase_unavailable
    if _firebase_unavailable:
        return None
    if _firebase_initialized:
        return get_app()

    try:
        if settings.FCM_SERVICE_ACCOUNT_JSON:
            info = json.loads(settings.FCM_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(info)
        elif settings.FCM_SERVICE_ACCOUNT_FILE:
            if not os.path.exists(settings.FCM_SERVICE_ACCOUNT_FILE):
                logger.warning('FCM non configuré: fichier de service Firebase introuvable: %s', settings.FCM_SERVICE_ACCOUNT_FILE)
                _firebase_unavailable = True
                return None
            cred = credentials.Certificate(settings.FCM_SERVICE_ACCOUNT_FILE)
        else:
            logger.warning('FCM non configuré: aucune clé de service Firebase fournie.')
            _firebase_unavailable = True
            return None
        app = initialize_app(cred)
        _firebase_initialized = True
        return app
    except ValueError:
        _firebase_initialized = True
        return get_app()
    except Exception:
        _firebase_unavailable = True
        logger.exception('Impossible d initialiser Firebase Admin.')
        return None


def _serialize_notification(notification, title, body, data):
    return {
        'id': str(notification.id) if notification else '',
        'title': title,
        'body': body,
        'data': data or {},
        'url': (data or {}).get('url', ''),
        'created_at': timezone.localtime(notification.created_at).isoformat() if notification else timezone.localtime().isoformat(),
    }


def _send_websocket(user_id, payload):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return False
    async_to_sync(channel_layer.group_send)(
        user_group_name(user_id),
        {'type': 'notification.message', 'notification': payload},
    )
    return True


def _send_fcm(user_id, title, body, data):
    if not _firebase_app():
        return {'sent': 0, 'failed': 0}

    tokens = list(
        FCMDeviceToken.objects.filter(user_id=user_id, is_active=True)
        .values_list('token', flat=True)
    )
    sent = 0
    failed = 0
    for token in tokens:
        try:
            payload_data = {str(k): str(v) for k, v in (data or {}).items()}
            actions = []
            if payload_data.get('action_accept_url'):
                actions.append(messaging.WebpushNotificationAction(action='accept', title='Accepter'))
            if payload_data.get('action_refuse_url'):
                actions.append(messaging.WebpushNotificationAction(action='refuse', title='Refuser'))
            message = messaging.Message(
                token=token,
                notification=messaging.Notification(title=title, body=body),
                data=payload_data,
                webpush=messaging.WebpushConfig(
                    headers={'Urgency': 'high'},
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=body,
                        icon='/static/logo_orange.png',
                        badge='/static/logo_orange.png',
                        tag=payload_data.get('notification_id') or payload_data.get('order_id') or title,
                        require_interaction=True,
                        renotify=True,
                        actions=actions or None,
                        data=payload_data,
                    ),
                    fcm_options=messaging.WebpushFCMOptions(link=payload_data.get('url') or '/'),
                ),
            )
            messaging.send(message)
            sent += 1
        except FirebaseError as exc:
            failed += 1
            logger.warning('FCM token invalide ou échec FCM user=%s token=%s error=%s', user_id, token[:12], exc)
            FCMDeviceToken.objects.filter(token=token).update(is_active=False)
        except Exception:
            failed += 1
            logger.exception('Erreur FCM inattendue user=%s', user_id)
    return {'sent': sent, 'failed': failed}


def send_bar_notification(user_id, title, body, data=None):
    """
    Envoie une notification BarPilote en mode hybride.

    1. La notification est persistée en base.
    2. Si l'utilisateur a au moins une connexion WebSocket active, on pousse en temps réel.
    3. Sinon, on bascule vers Firebase Cloud Messaging pour les appareils enregistrés.
    """
    User = get_user_model()
    user = User.objects.filter(id=user_id).first()
    if not user:
        return {'channel': 'none', 'reason': 'user_not_found'}

    data = data or {}
    notification = Notification.objects.create(
        recipient=user,
        title=title[:160],
        message=body or '',
        category=data.get('category', 'SYSTEM'),
        url=data.get('url', ''),
        data=data,
    )
    payload = _serialize_notification(notification, title, body, data)

    fcm_data = {**data, 'notification_id': str(notification.id), 'title': title, 'body': body}
    if is_user_ws_online(user_id):
        try:
            _send_websocket(user_id, payload)
            # Les commandes doivent aussi sortir en push: sur Android/PWA le navigateur
            # peut suspendre la page alors que la presence WebSocket expire avec retard.
            if data.get('category') == 'ORDER':
                fcm_result = _send_fcm(user_id, title, body, fcm_data)
                return {'channel': 'websocket+fcm', 'notification_id': str(notification.id), **fcm_result}
            return {'channel': 'websocket', 'notification_id': str(notification.id)}
        except Exception:
            logger.exception('Échec WebSocket, fallback FCM user=%s', user_id)

    result = _send_fcm(user_id, title, body, fcm_data)
    return {'channel': 'fcm', 'notification_id': str(notification.id), **result}
