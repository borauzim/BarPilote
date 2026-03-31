from rest_framework import viewsets, permissions, status
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
        # Sauvegarde le bar (code_invitation auto-généré par le modèle)
        bar = serializer.save()
        
        # Lie le bar au profil du pilote de l'utilisateur connecté
        profile = PilotProfile.objects.get(user=self.request.user)
        profile.bar = bar
        profile.save()

    @action(detail=False, methods=['post'], url_path='join/(?P<code>[^/.]+)',
            permission_classes=[permissions.IsAuthenticated])
    def join_bar(self, request, code=None):
        """
        Endpoint scanné par les serveurs via QR code.
        Lie le profil du serveur à l'établissement correspondant au code.
        """
        try:
            bar = Bar.objects.get(code_invitation=code)
        except Bar.DoesNotExist:
            return Response(
                {'detail': 'Code d\'invitation invalide. Vérifiez le QR code.'},
                status=status.HTTP_404_NOT_FOUND
            )

        profile, created = PilotProfile.objects.get_or_create(user=request.user)
        
        # Si le serveur est déjà lié à ce bar
        if profile.bar == bar:
            return Response({
                'detail': f'Vous êtes déjà membre de {bar.nom}.',
                'bar_nom': bar.nom,
                'bar_id': str(bar.id),
            })

        # Lier le serveur à l'établissement
        profile.bar = bar
        if profile.role not in ['PROPRIETAIRE']:
            profile.role = 'SERVEUR'
        profile.save()

        return Response({
            'detail': f'Bienvenue chez {bar.nom} ! Vous êtes maintenant connecté.',
            'bar_nom': bar.nom,
            'bar_id': str(bar.id),
            'bar_type': bar.get_type_etablissement_display(),
            'role': profile.get_role_display(),
        }, status=status.HTTP_200_OK)

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
