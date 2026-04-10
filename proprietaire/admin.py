from django.contrib import admin
from .models import Bar, PilotProfile, Table, StockItem, StockSupply, Category, MasterProduct, Sale, Order, OrderItem, StaffShift

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('nom', 'icon')

@admin.register(MasterProduct)
class MasterProductAdmin(admin.ModelAdmin):
    list_display = ('nom', 'categorie', 'volume')
    list_filter = ('categorie',)

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ('item', 'table', 'quantite', 'prix_unitaire_applique', 'devise', 'date_vente')
    list_filter = ('date_vente', 'bar', 'devise')

@admin.register(StockItem)
class StockItemAdmin(admin.ModelAdmin):
    list_display = ('produit', 'bar', 'quantite_actuelle', 'devise', 'prix_vente_unitaire')
    list_filter = ('bar', 'devise')

@admin.register(StockSupply)
class StockSupplyAdmin(admin.ModelAdmin):
    list_display = ('item', 'casiers_achetes', 'prix_achat_casier', 'date_achat')
    list_filter = ('date_achat', 'item__bar')

@admin.register(Bar)
class BarAdmin(admin.ModelAdmin):
    list_display = ('nom', 'adresse', 'type_etablissement', 'code_invitation', 'date_creation')
    search_fields = ('nom',)
    list_filter = ('type_etablissement',)

# ── GESTION DE L'ÉQUIPE ──────────────────────────────────────────────────────

@admin.register(PilotProfile)
class PilotProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'prenom', 'nom', 'role', 'bar', 'telephone')
    list_filter = ('role', 'bar', 'sexe')           # ← Filtrer par SERVEUR / PROPRIETAIRE
    search_fields = ('user__username', 'nom', 'prenom', 'telephone')
    ordering = ('role', 'nom')

@admin.register(StaffShift)
class StaffShiftAdmin(admin.ModelAdmin):
    list_display = ('worker', 'bar', 'status', 'start_time', 'end_time')
    list_filter = ('status', 'bar')
    search_fields = ('worker__nom', 'worker__prenom')
    ordering = ('-start_time',)

# ── GESTION DES COMMANDES ────────────────────────────────────────────────────

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('prix_unitaire', 'devise')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'table', 'serveur', 'statut', 'bar', 'date_creation')
    list_filter = ('statut', 'bar', 'date_creation')
    search_fields = ('table__nom', 'serveur__nom')
    ordering = ('-date_creation',)
    inlines = [OrderItemInline]              # ← Voir les articles d'une commande directement

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product_item', 'quantite', 'prix_unitaire', 'devise')
    list_filter = ('devise',)

# ── TABLES ───────────────────────────────────────────────────────────────────

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('nom', 'bar', 'est_active', 'date_creation')
    list_filter = ('est_active', 'bar')
    search_fields = ('nom',)
