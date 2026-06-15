from rest_framework import serializers
from django.contrib.auth.models import User
from proprietaire.models import Bar
from .models import ServeurProfile, Shift, CommandeServeur

class ServeurProfileSerializer(serializers.ModelSerializer):
    """Serializer pour le profil du serveur"""
    bar_nom = serializers.CharField(source='bar.nom', read_only=True)
    bar_id = serializers.UUIDField(source='bar.id', read_only=True)
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ServeurProfile
        fields = [
            'id', 'user', 'nom', 'postnom', 'prenom', 'email', 'telephone', 
            'sexe', 'photo', 'bar', 'bar_nom', 'bar_id', 'date_embauche', 
            'actif', 'inventory_access_granted', 'tables_access_granted', 'reports_access_granted',
            'confirmation_status', 'full_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'user', 'bar', 'actif', 'inventory_access_granted',
            'tables_access_granted', 'reports_access_granted',
            'confirmation_status', 'date_embauche', 'created_at', 'updated_at'
        ]
    
    def get_full_name(self, obj):
        if obj.postnom:
            return f"{obj.prenom} {obj.postnom} {obj.nom}"
        return f"{obj.prenom} {obj.nom}"

class ShiftSerializer(serializers.ModelSerializer):
    """Serializer pour les quart de travail"""
    serveur_nom = serializers.CharField(source='serveur.prenom', read_only=True)
    serveur_prenom = serializers.CharField(source='serveur.prenom', read_only=True)
    bar_nom = serializers.CharField(source='bar.nom', read_only=True)
    duree = serializers.SerializerMethodField()
    
    class Meta:
        model = Shift
        fields = [
            'id', 'serveur', 'serveur_nom', 'serveur_prenom', 'bar', 'bar_nom',
            'start_time', 'end_time', 'status', 'notes', 'duree', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_duree(self, obj):
        if obj.end_time and obj.start_time:
            diff = obj.end_time - obj.start_time
            hours = diff.total_seconds() / 3600
            return round(hours, 2)
        return None

class CommandeServeurSerializer(serializers.ModelSerializer):
    """Serializer pour les commandes du serveur"""
    serveur_nom = serializers.CharField(source='serveur.prenom', read_only=True)
    bar_nom = serializers.CharField(source='bar.nom', read_only=True)
    temps_attente = serializers.SerializerMethodField()
    
    class Meta:
        model = CommandeServeur
        fields = [
            'id', 'numero', 'serveur', 'serveur_nom', 'bar', 'bar_nom',
            'table', 'statut', 'total_usd', 'total_cdf', 'notes',
            'heure_commande', 'heure_serve', 'heure_paiement', 
            'temps_attente', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_temps_attente(self, obj):
        if obj.heure_serve and obj.heure_commande:
            diff = obj.heure_serve - obj.heure_commande
            minutes = diff.total_seconds() / 60
            return round(minutes, 1)
        return None

class ServeurProfileCreateSerializer(serializers.ModelSerializer):
    """Serializer spécialisé pour la création de profil serveur"""
    bar_id = serializers.CharField(write_only=True)  # Changer de IntegerField à CharField pour les UUID
    postnom = serializers.CharField(required=False, allow_blank=True)  # Permettre les valeurs vides
    email = serializers.CharField(required=False, allow_blank=True)  # Permettre les valeurs vides
    
    class Meta:
        model = ServeurProfile
        fields = ['nom', 'postnom', 'prenom', 'email', 'telephone', 'sexe', 'photo', 'bar_id']
    
    def validate_bar_id(self, value):
        """Vérifier que le bar existe (UUID)"""
        try:
            from uuid import UUID
            # Convertir l'UUID en format valide
            uuid_value = UUID(value)
            bar = Bar.objects.get(id=uuid_value)
            return str(uuid_value)  # Retourner l'UUID comme string
        except (ValueError, Bar.DoesNotExist):
            raise serializers.ValidationError("Bar non trouvé")
    
    def validate_postnom(self, value):
        """Permettre que postnom soit vide"""
        return value or ""  # Retourner une chaîne vide si None ou vide
    
    def validate_email(self, value):
        """Valider le format de l'email et vérifier l'unicité"""
        request = self.context.get('request')
        if not value:
            if request and request.user.email:
                value = request.user.email
            elif request:
                value = f"{request.user.username}@barpilote.local"
            else:
                raise serializers.ValidationError("Veuillez entrer une adresse email valide")

        if '@' not in value:
            raise serializers.ValidationError("Veuillez entrer une adresse email valide")

        existing = ServeurProfile.objects.filter(email=value)
        if request and request.user.is_authenticated:
            existing = existing.exclude(user=request.user)
        if existing.exists():
            raise serializers.ValidationError("Cet email est déjà utilisé par un autre serveur")

        return value.lower().strip()
    
    def validate_telephone(self, value):
        """Valider le format du téléphone"""
        if not value or len(value.strip()) < 8:
            raise serializers.ValidationError("Le numéro de téléphone doit contenir au moins 8 caractères")
        return value.strip()
    
    def create(self, validated_data):
        """Créer le profil serveur"""
        bar_id = validated_data.pop('bar_id')
        
        try:
            from uuid import UUID
            # Convertir l'UUID en format valide pour la recherche
            uuid_value = UUID(bar_id)
            bar = Bar.objects.get(id=uuid_value)
        except (ValueError, Bar.DoesNotExist):
            raise serializers.ValidationError("Bar non trouvé")
        
        # Récupérer l'utilisateur depuis le contexte
        user = self.context['request'].user
        
        # Utiliser l'email de l'utilisateur connecté
        validated_data['email'] = user.email or validated_data.get('email') or f"{user.username}@barpilote.local"
        
        profile, _created = ServeurProfile.objects.update_or_create(
            user=user,
            defaults={
                'bar': bar,
                'actif': True,
                'confirmation_status': 'PENDING',
                **validated_data,
            }
        )

        return profile

class DashboardServeurSerializer(serializers.Serializer):
    """Serializer pour le dashboard du serveur"""
    profile = ServeurProfileSerializer(read_only=True)
    shift_actif = ShiftSerializer(read_only=True)
    commandes_en_cours = CommandeServeurSerializer(many=True, read_only=True)
    commandes_recentes = CommandeServeurSerializer(many=True, read_only=True)
    statistiques = serializers.DictField(read_only=True)
    
    class Meta:
        fields = ['profile', 'shift_actif', 'commandes_en_cours', 'commandes_recentes', 'statistiques']
