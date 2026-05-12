from django.urls import path
from .html_views import ServeurDashboardView

urlpatterns = [
    path('dashboard/', ServeurDashboardView.as_view(), name='serveur_dashboard'),
]
