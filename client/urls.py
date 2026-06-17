from django.urls import path
from django.views.generic import RedirectView

from .views import (
    ClientHistoryView, ClientInvoiceDownloadView, ClientInvoicesView, ClientMenuView, ClientOrderActionView,
    ClientOrderStatusAPIView, ClientTrackOrderView,
)

urlpatterns = [
    path('<uuid:table_id>', RedirectView.as_view(pattern_name='client_menu', permanent=False)),
    path('<uuid:table_id>/', ClientMenuView.as_view(), name='client_menu'),
    path('<uuid:table_id>/history', RedirectView.as_view(pattern_name='client_history', permanent=False)),
    path('<uuid:table_id>/history/', ClientHistoryView.as_view(), name='client_history'),
    path('<uuid:table_id>/invoices', RedirectView.as_view(pattern_name='client_invoices', permanent=False)),
    path('<uuid:table_id>/invoices/', ClientInvoicesView.as_view(), name='client_invoices'),
    path('order/<uuid:order_id>/', ClientTrackOrderView.as_view(), name='client_track_order'),
    path('order/<uuid:order_id>/action/', ClientOrderActionView.as_view(), name='client_order_action'),
    path('order/<uuid:order_id>/invoice/', ClientInvoiceDownloadView.as_view(), name='client_invoice_download'),
    path('api/order/<uuid:order_id>/status/', ClientOrderStatusAPIView.as_view(), name='client_order_status_api'),
]
