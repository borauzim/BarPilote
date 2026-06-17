import json

from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache

USER_CONNECTION_TTL = 75


def user_group_name(user_id):
    return f'user_notifications_{user_id}'


def user_connection_cache_key(user_id):
    return f'ws:user:{user_id}:connections'


def client_order_group_name(order_id):
    return f'client_commande_{order_id}'


def bar_dashboard_group_name(bar_id):
    return 'notifications_proprietaire'


def is_user_ws_online(user_id):
    return int(cache.get(user_connection_cache_key(user_id), 0) or 0) > 0


class UserNotificationConsumer(AsyncWebsocketConsumer):
    """Canal WebSocket privé pour les notifications d'un utilisateur connecté."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.user_id = user.id
        self.group_name = user_group_name(self.user_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        self._mark_connected()
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            self._mark_disconnected()

    async def receive(self, text_data=None, bytes_data=None):
        # Le client peut envoyer un ping périodique pour garder l'état online à jour.
        if text_data:
            try:
                payload = json.loads(text_data)
            except json.JSONDecodeError:
                return
            if payload.get('type') == 'ping':
                self._refresh_presence()
                await self.send(text_data=json.dumps({'type': 'pong'}))

    async def notification_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification': event.get('notification', {}),
        }))

    def _mark_connected(self):
        key = user_connection_cache_key(self.user_id)
        count = int(cache.get(key, 0) or 0) + 1
        cache.set(key, count, USER_CONNECTION_TTL)

    def _mark_disconnected(self):
        key = user_connection_cache_key(self.user_id)
        count = max(0, int(cache.get(key, 0) or 0) - 1)
        if count:
            cache.set(key, count, USER_CONNECTION_TTL)
        else:
            cache.delete(key)

    def _refresh_presence(self):
        key = user_connection_cache_key(self.user_id)
        count = int(cache.get(key, 0) or 0)
        if count:
            cache.set(key, count, USER_CONNECTION_TTL)


class ClientOrderConsumer(AsyncWebsocketConsumer):
    """Canal public de suivi temps réel pour une commande client QR."""

    async def connect(self):
        self.order_id = self.scope['url_route']['kwargs']['order_id']
        self.group_name = client_order_group_name(self.order_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def commande_accepted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'commande.accepted',
            'commande': event.get('commande', {}),
        }))


class BarDashboardConsumer(AsyncWebsocketConsumer):
    """Canal privé des propriétaires/gérants pour recevoir les flux en temps réel."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        from channels.db import database_sync_to_async
        allowed = await database_sync_to_async(self._is_owner)(user)
        if not allowed:
            await self.close(code=4403)
            return

        self.group_name = bar_dashboard_group_name(None)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def proprietaire_commande_accepted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'proprietaire.commande_accepted',
            'commande': event.get('commande', {}),
            'dashboard': event.get('dashboard', {}),
        }))

    def _is_owner(self, user):
        from proprietaire.models import PilotProfile
        return PilotProfile.objects.filter(user=user, role='PROPRIETAIRE').exists()
