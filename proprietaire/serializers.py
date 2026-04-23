from rest_framework import serializers
from .models import Bar, PilotProfile, Table, Category, MasterProduct, StockItem, Sale, StockSupply, OrderItem, Order, StaffShift

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class MasterProductSerializer(serializers.ModelSerializer):
    categorie_nom = serializers.ReadOnlyField(source='categorie.nom')
    
    class Meta:
        model = MasterProduct
        fields = '__all__'

class BarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bar
        fields = ['id', 'nom', 'adresse', 'google_place_id', 'latitude', 'longitude', 'type_etablissement', 'date_creation', 'code_invitation']
        read_only_fields = ['code_invitation']

class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = '__all__'
        read_only_fields = ['bar']

class StockItemSerializer(serializers.ModelSerializer):
    produit_details = MasterProductSerializer(source='produit', read_only=True)
    marge = serializers.ReadOnlyField(source='marge_pourcentage')
    cout_revient = serializers.ReadOnlyField()

    class Meta:
        model = StockItem
        fields = [
            'id', 'bar', 'produit', 'produit_details', 'strategie_gestion',
            'quantite_actuelle', 'seuil_alerte', 'devise', 
            'prix_achat_casier', 'bouteilles_par_casier', 
            'prix_achat_unitaire', 'prix_vente_unitaire',
            'marge', 'cout_revient'
        ]
        read_only_fields = ['bar']

class StockSupplySerializer(serializers.ModelSerializer):
    class Meta:
        model = StockSupply
        fields = '__all__'

class SaleSerializer(serializers.ModelSerializer):
    produit_nom = serializers.ReadOnlyField(source='item.produit.nom')
    table_nom = serializers.ReadOnlyField(source='table.nom')

    class Meta:
        model = Sale
        fields = '__all__'

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product_item.produit.nom')
    
    class Meta:
        model = OrderItem
        fields = ['id', 'order', 'product_item', 'product_name', 'quantite', 'prix_unitaire', 'devise', 'statut', 'date_creation']
        extra_kwargs = {
            'order': {'required': False, 'allow_null': True}
        }

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, required=False)
    table_nom = serializers.ReadOnlyField(source='table.nom')
    serveur_nom = serializers.SerializerMethodField()
    statut_label = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'bar', 'table', 'table_nom', 'serveur', 'serveur_nom', 
            'statut', 'statut_label', 'total_usd', 'total_cdf', 
            'items', 'date_creation', 'date_service'
        ]
        extra_kwargs = {
            'bar': {'required': False, 'allow_null': True},
            'serveur': {'required': False, 'allow_null': True}
        }

    def get_serveur_nom(self, obj):
        if obj.serveur:
            return f"{obj.serveur.prenom} {obj.serveur.nom}"
        return "Non assigné"

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        order = Order.objects.create(**validated_data)
        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)
        return order

class PilotProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    bar_nom = serializers.ReadOnlyField(source='bar.nom')
    gerant_nom = serializers.SerializerMethodField()

    class Meta:
        model = PilotProfile
        fields = [
            'id', 'user', 'user_email', 'role', 'role_label', 
            'nom', 'postnom', 'prenom', 'sexe', 'telephone', 
            'photo_profil', 'bar', 'bar_nom', 'gerant_nom'
        ]
        read_only_fields = ['user', 'bar']

    def get_gerant_nom(self, obj):
        if obj.bar:
            gerant = obj.bar.proprietaires.first()
            if gerant:
                return f"{gerant.prenom} {gerant.nom}"
        return "Gérant BarPilote"

class StaffShiftSerializer(serializers.ModelSerializer):
    worker_name = serializers.ReadOnlyField(source='worker.prenom')
    
    class Meta:
        model = StaffShift
        fields = ['id', 'worker', 'worker_name', 'bar', 'start_time', 'end_time', 'status']
        read_only_fields = ['worker', 'bar', 'start_time', 'end_time']
