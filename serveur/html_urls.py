from django.urls import path
from proprietaire.html_views import AdvisorAPIView, NotificationsAPIView
from .html_views import (
    ServeurDashboardView, ServeurScanQRView, ServeurProfilSetupView,
    ServeurWelcomeView, ServeurCommandeDetailView, ServeurMissionView,
    ServeurShiftActionView, ServeurWaitingConfirmationView, ServeurJoinView, ServeurLogoutView, ServeurToggleCurrencyView, ServeurClientHistoryView, ServeurClientOrderActionView, ServeurUpdateOrderStatusView, ServeurTakeOrderView, ServeurInventoryView, ServeurFinanceView, ServeurClientsView, ServeurTeamView, ServeurTablesView, ServeurTableActionView, ServeurReportView, ServeurRecordLossView
)

urlpatterns = [
    path('dashboard/', ServeurDashboardView.as_view(), name='serveur_dashboard'),
    path('scan/', ServeurScanQRView.as_view(), name='serveur_scan'),
    path('logout/', ServeurLogoutView.as_view(), name='serveur_logout'),
    path('toggle-currency/', ServeurToggleCurrencyView.as_view(), name='serveur_toggle_currency'),
    path('api/client-history/', ServeurClientHistoryView.as_view(), name='serveur_client_history'),
    path('api/update-order-status/', ServeurUpdateOrderStatusView.as_view(), name='serveur_update_order_status'),
    path('api/client-order-action/', ServeurClientOrderActionView.as_view(), name='serveur_client_order_action'),
    path('api/notifications/', NotificationsAPIView.as_view(), name='serveur_notifications_api'),
    path('api/advisor/', AdvisorAPIView.as_view(), name='serveur_advisor_api'),
    path('join/<str:code>/', ServeurJoinView.as_view(), name='serveur_join'),
    path('setup/', ServeurProfilSetupView.as_view(), name='serveur_setup'),
    path('welcome/', ServeurWelcomeView.as_view(), name='serveur_welcome'),
    path('waiting-confirmation/', ServeurWaitingConfirmationView.as_view(), name='serveur_waiting_confirmation'),
    path('take-order/', ServeurTakeOrderView.as_view(), name='serveur_take_order'),
    path('inventory/', ServeurInventoryView.as_view(), name='serveur_inventory'),
    path('finance/', ServeurFinanceView.as_view(), name='serveur_finance'),
    path('clients/', ServeurClientsView.as_view(), name='serveur_clients'),
    path('team/', ServeurTeamView.as_view(), name='serveur_team'),
    path('tables/', ServeurTablesView.as_view(), name='serveur_tables'),
    path('tables/action/', ServeurTableActionView.as_view(), name='serveur_table_action'),
    path('reports/', ServeurReportView.as_view(), name='serveur_report'),
    path('commande/<uuid:order_id>/', ServeurCommandeDetailView.as_view(), name='serveur_commande_detail'),
    path('mission/<uuid:order_id>/', ServeurMissionView.as_view(), name='serveur_mission'),
    path('shift/', ServeurShiftActionView.as_view(), name='serveur_shift_action'),
    path('losses/', ServeurRecordLossView.as_view(), name='serveur_record_loss'),
]
