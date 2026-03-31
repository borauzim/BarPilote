from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import (
    BarViewSet, PilotProfileViewSet, TableViewSet, CategoryViewSet,
    MasterProductViewSet, StockItemViewSet, SaleViewSet
)

router = DefaultRouter()
router.register(r'bars', BarViewSet)
router.register(r'profile', PilotProfileViewSet)
router.register(r'tables', TableViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'master-products', MasterProductViewSet)
router.register(r'stock', StockItemViewSet)
router.register(r'sales', SaleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
