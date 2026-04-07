from rest_framework import serializers
from .models import Bar, PilotProfile, Table, Category, MasterProduct, StockItem, Sale

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

class StockItemSerializer(serializers.ModelSerializer):
    produit_details = MasterProductSerializer(source='produit', read_only=True)
    marge = serializers.ReadOnlyField(source='marge_pourcentage')

    class Meta:
        model = StockItem
        fields = '__all__'

class SaleSerializer(serializers.ModelSerializer):
    produit_nom = serializers.ReadOnlyField(source='item.produit.nom')
    table_nom = serializers.ReadOnlyField(source='table.nom')

    class Meta:
        model = Sale
        fields = '__all__'

class PilotProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    
    class Meta:
        model = PilotProfile
        fields = [
            'id', 'user', 'user_email', 'role', 'role_label', 
            'nom', 'postnom', 'prenom', 'sexe', 'telephone', 
            'photo_profil', 'bar'
        ]
        read_only_fields = ['user', 'bar']
