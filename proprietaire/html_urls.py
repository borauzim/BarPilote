from django.urls import path
from .html_views import (
    DashboardView, EstablishmentSetupView, ProfileSetupView,
    InventoryView, FinanceView, TeamView, TablesView, EstablishmentDetailsView, TableSetupView,
    TableActionView, TableDownloadQRView, EstablishmentReadyView, StaffInvitationPDFView
)

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard_html'),
    path('setup-bar/', EstablishmentSetupView.as_view(), name='establishment_setup'),
    path('profile-setup/', ProfileSetupView.as_view(), name='profile_setup'),
    path('inventory/', InventoryView.as_view(), name='inventory_html'),
    path('finance/', FinanceView.as_view(), name='finance_html'),
    path('team/', TeamView.as_view(), name='team_html'),
    path('tables/', TablesView.as_view(), name='tables_html'),
    path('setup-bar/details/', EstablishmentDetailsView.as_view(), name='establishment_details'),
    path('setup-bar/tables/', TableSetupView.as_view(), name='table_setup'),
    path('setup-bar/ready/', EstablishmentReadyView.as_view(), name='establishment_ready'),
    path('tables/action/', TableActionView.as_view(), name='table_action'),
    path('tables/download-qr/', TableDownloadQRView.as_view(), name='table_download_qr'),
    path('staff/download-invite/', StaffInvitationPDFView.as_view(), name='staff_download_invite'),
]
