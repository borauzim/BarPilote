from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Bar, PilotProfile, Table, Category, MasterProduct, StockItem, Sale
from .serializers import (
    BarSerializer, PilotProfileSerializer, TableSerializer, CategorySerializer, 
    MasterProductSerializer, StockItemSerializer, SaleSerializer
)

class PilotProfileViewSet(viewsets.ModelViewSet):
    queryset = PilotProfile.objects.all()
    serializer_class = PilotProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PilotProfile.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get', 'patch', 'put'])
    def me(self, request):
        profile, created = PilotProfile.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class BarViewSet(viewsets.ModelViewSet):
    queryset = Bar.objects.all()
    serializer_class = BarSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Un propriétaire ne voit que ses bars
        return Bar.objects.filter(proprietaires__user=self.request.user)

    def perform_create(self, serializer):
        # Sauvegarde le bar
        bar = serializer.save()
        
        # Lie le bar au profil du pilote de l'utilisateur connecté
        from .models import PilotProfile
        profile, _ = PilotProfile.objects.get_or_create(user=self.request.user)
        profile.bar = bar
        profile.role = 'PROPRIETAIRE'
        profile.save()

    @action(detail=False, methods=['post'], url_path='join/(?P<code>[^/.]+)')
    def join(self, request, code=None):
        try:
            bar = Bar.objects.get(code_invitation=code)
        except Bar.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Ce code d'invitation est invalide ou n'existe plus.")
            
        # Lie le profil du serveur connecté à ce bar
        from .models import PilotProfile
        profile, _ = PilotProfile.objects.get_or_create(user=request.user)
        profile.bar = bar
        profile.role = 'SERVEUR'
        profile.save()
        
        serializer = self.get_serializer(bar)
        return Response(serializer.data)

class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Table.objects.filter(bar__proprietaires__user=self.request.user)

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class MasterProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MasterProduct.objects.all()
    serializer_class = MasterProductSerializer

class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all()
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return StockItem.objects.filter(bar__proprietaires__user=self.request.user)

class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Sale.objects.filter(bar__proprietaires__user=self.request.user)
