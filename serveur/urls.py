from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Créer un routeur et enregistrer les viewsets
router = DefaultRouter()
router.register(r'profiles', views.ServeurProfileViewSet, basename='serveur-profile')
router.register(r'shifts', views.ShiftViewSet, basename='serveur-shift')
router.register(r'commandes', views.CommandeServeurViewSet, basename='serveur-commande')

# URLs de l'application serveur
urlpatterns = [
    # API endpoints pour les serveurs
    path('', include(router.urls)),
    
    # Dashboard spécifique pour les serveurs
    path('dashboard/', views.dashboard_serveur, name='dashboard-serveur'),
    path('inventory/', views.inventory_read_only, name='inventory-readonly'),
    path('tables/', views.tables_read_only, name='tables-readonly'),
    path('reports/me/', views.my_report, name='report-me'),
    
    # Endpoints spécifiques pour les shifts
    path('shifts/start/', views.ShiftViewSet.as_view({'post': 'start'}), name='shift-start'),
    path('shifts/end/', views.ShiftViewSet.as_view({'post': 'end'}), name='shift-end'),
    path('shifts/current/', views.ShiftViewSet.as_view({'get': 'current'}), name='shift-current'),
    
    # Endpoints spécifiques pour les commandes
    path('commandes/<int:pk>/mark_served/', views.CommandeServeurViewSet.as_view({'post': 'mark_served'}), name='commande-mark-served'),
    path('commandes/<int:pk>/mark_paid/', views.CommandeServeurViewSet.as_view({'post': 'mark_paid'}), name='commande-mark-paid'),
    
    # Endpoints spécifiques pour les profils
    path('profiles/me/', views.ServeurProfileViewSet.as_view({'get': 'me'}), name='profile-me'),
    path('profiles/update/', views.ServeurProfileViewSet.as_view({'patch': 'update_profile'}), name='profile-update'),
    path('profile-create/', views.create_serveur_profile, name='profile-create'),
    
    # Endpoints pour les formulaires
    path('commandes/create/', views.create_commande, name='create-commande'),
    path('shifts/update_status/', views.update_shift_status, name='update-shift-status'),
    
    # Endpoint pour vérifier les codes d'invitation
    path('verify-invitation/', views.verify_invitation, name='verify-invitation'),
]
