from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import (
    BarViewSet, PilotProfileViewSet, TableViewSet, CategoryViewSet,
    MasterProductViewSet, StockItemViewSet, SaleViewSet, StockSupplyViewSet,
    DashboardViewSet, OrderViewSet, OrderItemViewSet, FinancialReportViewSet,
    StaffManagementViewSet, StaffShiftViewSet
)

router = DefaultRouter()
router.register(r'bars', BarViewSet)
router.register(r'profile', PilotProfileViewSet)
router.register(r'tables', TableViewSet)
router.register(r'shifts', StaffShiftViewSet)
router.register(r'supplies', StockSupplyViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'master-products', MasterProductViewSet)
router.register(r'stock', StockItemViewSet)
router.register(r'sales', SaleViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'order-items', OrderItemViewSet)
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'reports', FinancialReportViewSet, basename='reports')
router.register(r'staff', StaffManagementViewSet, basename='staff')

urlpatterns = [
    path('', include(router.urls)),
]
