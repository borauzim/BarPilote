from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, Sum, Avg
from django.contrib.auth.models import User
from proprietaire.models import Bar, PilotProfile, StockItem, Table, Order
from .models import ServeurProfile, Shift, CommandeServeur, InvitationCode
from .invitations import InvitationError, resolve_invitation
from .serializers import (
    ServeurProfileSerializer, ServeurProfileCreateSerializer, ShiftSerializer, 
    CommandeServeurSerializer, DashboardServeurSerializer
)
from proprietaire.serializers import StockItemSerializer, TableSerializer, OrderSerializer

class ServeurProfileViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les profils des serveurs"""
    serializer_class = ServeurProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ServeurProfile.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Endpoint pour obtenir le profil du serveur connecté"""
        profile = ServeurProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response(
                {'error': 'Aucun profil trouvé pour cet utilisateur'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def create_profile(self, request):
        """Créer le profil serveur après scan QR"""
        serializer = ServeurProfileCreateSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            profile = serializer.save()
            profile_serializer = ServeurProfileSerializer(profile)
            return Response({
                'message': 'Profil serveur créé avec succès',
                'profile': profile_serializer.data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'error': 'Erreur de validation',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['patch'])
    def update_profile(self, request):
        """Mettre à jour le profil du serveur"""
        profile = ServeurProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response(
                {'error': 'Aucun profil trouvé pour cet utilisateur'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_serveur_profile(request):
    """Vue dédiée pour créer un profil serveur"""
    serializer = ServeurProfileCreateSerializer(
        data=request.data,
        context={'request': request}
    )

    if serializer.is_valid():
        profile = serializer.save()
        profile_serializer = ServeurProfileSerializer(profile)
        return Response({
            'message': 'Profil serveur créé avec succès',
            'profile': profile_serializer.data
        }, status=status.HTTP_201_CREATED)

    return Response({
        'error': 'Erreur de validation',
        'details': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

class ShiftViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les quart de travail"""
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Un serveur ne voit que ses shifts
        try:
            profile = ServeurProfile.objects.get(user=self.request.user)
            return Shift.objects.filter(serveur=profile).order_by('-created_at')
        except ServeurProfile.DoesNotExist:
            return Shift.objects.none()
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """Démarrer un nouveau quart de travail"""
        try:
            profile = ServeurProfile.objects.get(user=request.user)
        except ServeurProfile.DoesNotExist:
            return Response(
                {'error': 'Aucun profil trouvé pour cet utilisateur'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Vérifier si un shift est déjà actif
        shift_actif = Shift.objects.filter(
            serveur=profile, 
            status__in=['ACTIVE', 'BREAK']
        ).first()
        
        if shift_actif:
            return Response(
                {'error': 'Un quart de travail est déjà actif'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Créer le nouveau shift
        shift = Shift.objects.create(
            serveur=profile,
            bar=profile.bar,
            start_time=timezone.now(),
            status='ACTIVE'
        )
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def end(self, request):
        """Terminer le quart de travail actif"""
        try:
            profile = ServeurProfile.objects.get(user=request.user)
        except ServeurProfile.DoesNotExist:
            return Response(
                {'error': 'Aucun profil trouvé pour cet utilisateur'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Trouver le shift actif
        shift_actif = Shift.objects.filter(
            serveur=profile, 
            status__in=['ACTIVE', 'BREAK']
        ).first()
        
        if not shift_actif:
            return Response(
                {'error': 'Aucun quart de travail actif'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Terminer le shift
        shift_actif.end_time = timezone.now()
        shift_actif.status = 'ENDED'
        shift_actif.save()
        
        serializer = self.get_serializer(shift_actif)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Obtenir le quart de travail actif"""
        try:
            profile = ServeurProfile.objects.get(user=request.user)
        except ServeurProfile.DoesNotExist:
            return Response({'detail': 'Aucun profil trouvé'}, status=status.HTTP_404_NOT_FOUND)
        
        shift_actif = Shift.objects.filter(
            serveur=profile, 
            status__in=['ACTIVE', 'BREAK']
        ).first()
        
        if shift_actif:
            serializer = self.get_serializer(shift_actif)
            return Response(serializer.data)
        
        return Response({'detail': 'Aucun quart de travail actif'}, status=status.HTTP_404_NOT_FOUND)

class CommandeServeurViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les commandes du serveur"""
    serializer_class = CommandeServeurSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Un serveur ne voit que ses commandes
        try:
            profile = ServeurProfile.objects.get(user=self.request.user)
            queryset = CommandeServeur.objects.filter(serveur=profile)
        except ServeurProfile.DoesNotExist:
            queryset = CommandeServeur.objects.none()
        
        # Filtrer par statut si spécifié
        statut = self.request.query_params.get('statut')
        if statut:
            queryset = queryset.filter(statut=statut)
        
        # Exclure les commandes payées si demandé
        exclude_paid = self.request.query_params.get('exclude_paid', 'false').lower() == 'true'
        if exclude_paid:
            queryset = queryset.exclude(statut='PAID')
        
        # Limiter le nombre de résultats
        limit = self.request.query_params.get('limit')
        if limit and limit.isdigit():
            queryset = queryset[:int(limit)]
        
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def mark_served(self, request, pk=None):
        """Marquer une commande comme servie"""
        commande = self.get_object()
        
        if commande.statut == 'SERVED':
            return Response(
                {'error': 'Commande déjà servie'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        commande.statut = 'SERVED'
        commande.heure_serve = timezone.now()
        commande.save()
        
        serializer = self.get_serializer(commande)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Marquer une commande comme payée"""
        commande = self.get_object()
        
        if commande.statut == 'PAID':
            return Response(
                {'error': 'Commande déjà payée'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        commande.statut = 'PAID'
        commande.heure_paiement = timezone.now()
        commande.save()
        
        serializer = self.get_serializer(commande)
        return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def verify_invitation(request):
    """Vérifier un code d'invitation et retourner les informations du bar"""
    invitation_code = request.data.get('invitation_code') or request.data.get('code')

    try:
        bar, _invitation, normalized_code = resolve_invitation(invitation_code)
    except InvitationError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    proprietaire = bar.proprietaires.first()
    proprietaire_nom = f"{proprietaire.prenom} {proprietaire.nom}".strip() if proprietaire else "Propriétaire BarPilote"
    proprietaire_email = proprietaire.user.email if proprietaire else ""

    localisation = "Kinshasa, RDC"
    if bar.adresse:
        adresse_parts = [part.strip() for part in bar.adresse.split(',') if part.strip()]
        if len(adresse_parts) >= 2:
            localisation = f"{adresse_parts[-2]}, {adresse_parts[-1]}"
        else:
            localisation = bar.adresse

    existing_profile = ServeurProfile.objects.filter(user=request.user, bar=bar).exists()

    return Response({
        'bar_id': str(bar.id),
        'bar_nom': bar.nom,
        'proprietaire_id': str(proprietaire.id) if proprietaire else None,
        'proprietaire_nom': proprietaire_nom,
        'proprietaire_email': proprietaire_email,
        'localisation': localisation,
        'invitation_code': str(normalized_code),
        'bar_type': bar.type_etablissement,
        'is_valid': True,
        'existing_profile': existing_profile,
    }, status=status.HTTP_200_OK)

def _get_authorized_serveur_profile(request, required_flag=None):
    profile = get_object_or_404(ServeurProfile, user=request.user)
    if not profile.bar:
        return None, Response({'error': 'Profil incomplet.'}, status=status.HTTP_400_BAD_REQUEST)
    if profile.confirmation_status != 'CONFIRMED':
        return None, Response({'error': 'Profil non confirmé.'}, status=status.HTTP_403_FORBIDDEN)
    if required_flag and not getattr(profile, required_flag, False):
        return None, Response({'error': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)
    return profile, None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def inventory_read_only(request):
    profile, error_response = _get_authorized_serveur_profile(request, 'inventory_access_granted')
    if error_response:
        return error_response

    items = StockItem.objects.filter(bar=profile.bar).select_related('produit', 'produit__categorie').order_by('produit__nom')
    payload = StockItemSerializer(items, many=True).data
    for item, obj in zip(payload, items):
        item['product_name'] = obj.produit.nom
        item['category_name'] = obj.produit.categorie.nom if obj.produit.categorie else None
    return Response({
        'bar': {'id': str(profile.bar.id), 'nom': profile.bar.nom},
        'items': payload,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def tables_read_only(request):
    profile, error_response = _get_authorized_serveur_profile(request, 'tables_access_granted')
    if error_response:
        return error_response

    tables = Table.objects.filter(bar=profile.bar).order_by('nom')
    occupied_table_ids = set(Order.objects.filter(bar=profile.bar, statut__in=['PENDING', 'PREPARING', 'SERVED']).values_list('table_id', flat=True))
    payload = []
    for table in tables:
        payload.append({
            'table': TableSerializer(table).data,
            'is_occupied': table.id in occupied_table_ids,
        })

    return Response({
        'bar': {'id': str(profile.bar.id), 'nom': profile.bar.nom},
        'tables': payload,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_report(request):
    profile, error_response = _get_authorized_serveur_profile(request, 'reports_access_granted')
    if error_response:
        return error_response

    pilot_profile = PilotProfile.objects.filter(user=request.user).first()
    if not pilot_profile:
        return Response({'error': 'Profil pilote introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    orders = Order.objects.filter(bar=profile.bar, serveur=pilot_profile).order_by('-date_creation')
    served_orders = orders.filter(statut__in=['SERVED', 'PAID'])
    return Response({
        'bar': {'id': str(profile.bar.id), 'nom': profile.bar.nom},
        'summary': {
            'orders_count': orders.count(),
            'served_orders_count': served_orders.count(),
            'open_orders': orders.exclude(statut__in=['PAID', 'CANCELLED']).count(),
            'tables_touched': orders.values('table_id').distinct().count(),
            'total_usd': float(served_orders.aggregate(total=Sum('total_usd'))['total'] or 0),
            'total_cdf': float(served_orders.aggregate(total=Sum('total_cdf'))['total'] or 0),
        },
        'orders': OrderSerializer(orders[:20], many=True).data,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_serveur(request):
    """Dashboard complet pour le serveur"""
    print(f"🔍 Dashboard demandé par utilisateur: {request.user}")
    print(f"🔍 Email utilisateur: {request.user.email}")
    
    try:
        profile = ServeurProfile.objects.get(user=request.user)
        print(f"✅ Profil trouvé: {profile}")
    except ServeurProfile.DoesNotExist:
        print(f"❌ Aucun profil trouvé pour l'utilisateur: {request.user}")
        return Response(
            {'error': 'Aucun profil serveur trouvé. Veuillez scanner un QR code pour créer votre profil.'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Obtenir le shift actif
    shift_actif = Shift.objects.filter(
        serveur=profile, 
        status__in=['ACTIVE', 'BREAK']
    ).first()
    
    # Commandes en cours (non payées)
    commandes_en_cours = CommandeServeur.objects.filter(
        serveur=profile
    ).exclude(statut='PAID').order_by('-created_at')[:10]
    
    # Commandes récentes
    commandes_recentes = CommandeServeur.objects.filter(
        serveur=profile
    ).order_by('-created_at')[:6]
    
    # Statistiques
    commandes_today = CommandeServeur.objects.filter(
        serveur=profile,
        heure_commande__date=timezone.now().date()
    )
    
    statistiques = {
        'commandes_aujourdhui': commandes_today.count(),
        'commandes_en_cours': commandes_en_cours.count(),
        'total_usd_aujourdhui': commandes_today.aggregate(
            total=Sum('total_usd')
        )['total'] or 0,
        'total_cdf_aujourdhui': commandes_today.aggregate(
            total=Sum('total_cdf')
        )['total'] or 0,
        'temps_service_moyen': commandes_today.filter(
            heure_serve__isnull=False
        ).aggregate(
            avg_temps=Avg('heure_serve') - Avg('heure_commande')
        )['avg_temps'],
    }
    
    # Serializer les données
    data = {
        'profile': ServeurProfileSerializer(profile).data,
        'shift_actif': ShiftSerializer(shift_actif).data if shift_actif else None,
        'commandes_en_cours': CommandeServeurSerializer(commandes_en_cours, many=True).data,
        'commandes_recentes': CommandeServeurSerializer(commandes_recentes, many=True).data,
        'statistiques': statistiques
    }
    
    return Response(data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_commande(request):
    """Créer une nouvelle commande depuis le formulaire"""
    profile = get_object_or_404(ServeurProfile, user=request.user)
    
    # Vérifier qu'un shift est actif
    shift_actif = Shift.objects.filter(
        serveur=profile, 
        status__in=['ACTIVE', 'BREAK']
    ).first()
    
    if not shift_actif:
        return Response(
            {'error': 'Aucun quart de travail actif. Veuillez démarrer un quart d\'abord.'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Récupérer les données du formulaire
    table = request.data.get('table', '')
    total_usd = request.data.get('total_usd', 0)
    total_cdf = request.data.get('total_cdf', 0)
    notes = request.data.get('notes', '')
    
    # Validation
    if not table:
        return Response(
            {'error': 'Le numéro de table est requis'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Générer un numéro de commande unique
        import uuid
        numero = f"CMD{timezone.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"
        
        # Créer la commande
        commande = CommandeServeur.objects.create(
            numero=numero,
            serveur=profile,
            bar=profile.bar,
            table=table.strip(),
            total_usd=float(total_usd) if total_usd else 0,
            total_cdf=int(total_cdf) if total_cdf else 0,
            notes=notes.strip() if notes else '',
            statut='PENDING'
        )
        
        serializer = CommandeServeurSerializer(commande)
        return Response({
            'message': 'Commande créée avec succès',
            'commande': serializer.data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response(
            {'error': f'Erreur lors de la création: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_shift_status(request):
    """Mettre à jour le statut d'un shift (ACTIVE/BREAK/ENDED)"""
    profile = get_object_or_404(ServeurProfile, user=request.user)
    
    # Récupérer le shift actif
    shift_actif = Shift.objects.filter(
        serveur=profile, 
        status__in=['ACTIVE', 'BREAK']
    ).first()
    
    if not shift_actif:
        return Response(
            {'error': 'Aucun quart de travail actif'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    new_status = request.data.get('status')
    notes = request.data.get('notes', '')
    
    if new_status not in ['ACTIVE', 'BREAK', 'ENDED']:
        return Response(
            {'error': 'Statut invalide. Options: ACTIVE, BREAK, ENDED'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        shift_actif.status = new_status
        if notes:
            shift_actif.notes = notes.strip()
        
        if new_status == 'ENDED':
            shift_actif.end_time = timezone.now()
        
        shift_actif.save()
        
        serializer = ShiftSerializer(shift_actif)
        return Response({
            'message': f'Statut du quart mis à jour: {new_status}',
            'shift': serializer.data
        })
        
    except Exception as e:
        return Response(
            {'error': f'Erreur lors de la mise à jour: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
