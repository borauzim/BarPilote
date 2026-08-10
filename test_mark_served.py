import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'barpilote.settings')
django.setup()

from proprietaire.models import Order
from rest_framework.test import APIClient
from django.contrib.auth.models import User

order = Order.objects.first()
user = User.objects.first()

if order and user:
    client = APIClient()
    client.force_authenticate(user=user)
    print(f"Testing order {order.id}")
    resp = client.post(f'/api/proprietaire/orders/{order.id}/mark_served/')
    print("Status:", resp.status_code)
    print("Response:", resp.content.decode())
else:
    print("No order or user found")
