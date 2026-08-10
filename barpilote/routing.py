from django.urls import path

from services.consumers import BarDashboardConsumer, ClientOrderConsumer, ServerDashboardConsumer, UserNotificationConsumer

websocket_urlpatterns = [
    path('ws/notifications/', UserNotificationConsumer.as_asgi()),
    path('ws/client/order/<uuid:order_id>/', ClientOrderConsumer.as_asgi()),
    path('ws/proprietaire/dashboard/', BarDashboardConsumer.as_asgi()),
    path('ws/serveur/dashboard/', ServerDashboardConsumer.as_asgi()),
]
