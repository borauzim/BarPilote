from django.contrib import admin
from django.utils.html import format_html
from .models import ServeurProfile, Shift, CommandeServeur

@admin.register(ServeurProfile)
class ServeurProfileAdmin(admin.ModelAdmin):
    """Configuration admin pour les profils de serveurs"""
    list_display = [
        'full_name', 'email', 'telephone', 'bar', 'actif', 'date_embauche'
    ]
    list_filter = ['actif', 'bar', 'date_embauche']
    search_fields = ['nom', 'prenom', 'email', 'telephone']
    list_editable = ['actif']
    readonly_fields = ['date_embauche', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Informations personnelles', {
            'fields': ('user', 'nom', 'prenom', 'email', 'telephone', 'photo')
        }),
        ('Affectation', {
            'fields': ('bar', 'actif')
        }),
        ('Informations système', {
            'fields': ('date_embauche', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def full_name(self, obj):
        return f"{obj.prenom} {obj.nom}"
    full_name.short_description = 'Nom complet'

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    """Configuration admin pour les quart de travail"""
    list_display = [
        'serveur_info', 'bar', 'start_time', 'end_time', 'status', 'duree_shift'
    ]
    list_filter = ['status', 'bar', 'start_time']
    search_fields = ['serveur__nom', 'serveur__prenom', 'bar__nom']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Informations du shift', {
            'fields': ('serveur', 'bar', 'start_time', 'end_time', 'status', 'notes')
        }),
        ('Informations système', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def serveur_info(self, obj):
        return f"{obj.serveur.prenom} {obj.serveur.nom}"
    serveur_info.short_description = 'Serveur'
    
    def duree_shift(self, obj):
        if obj.end_time and obj.start_time:
            diff = obj.end_time - obj.start_time
            hours = diff.total_seconds() / 3600
            return f"{hours:.1f}h"
        return "-"
    duree_shift.short_description = 'Durée'

@admin.register(CommandeServeur)
class CommandeServeurAdmin(admin.ModelAdmin):
    """Configuration admin pour les commandes des serveurs"""
    list_display = [
        'numero', 'serveur_info', 'table', 'statut', 'total_affiche', 
        'heure_commande', 'temps_service'
    ]
    list_filter = ['statut', 'bar', 'heure_commande']
    search_fields = ['numero', 'serveur__nom', 'serveur__prenom', 'table']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Informations commande', {
            'fields': ('numero', 'serveur', 'bar', 'table', 'statut', 'notes')
        }),
        ('Montants', {
            'fields': ('total_usd', 'total_cdf')
        }),
        ('Horodatage', {
            'fields': ('heure_commande', 'heure_serve', 'heure_paiement')
        }),
        ('Informations système', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def serveur_info(self, obj):
        return f"{obj.serveur.prenom} {obj.serveur.nom}"
    serveur_info.short_description = 'Serveur'
    
    def total_affiche(self, obj):
        total = []
        if obj.total_usd > 0:
            total.append(f"${obj.total_usd}")
        if obj.total_cdf > 0:
            total.append(f"{obj.total_cdf} FC")
        return " + ".join(total) if total else "0"
    total_affiche.short_description = 'Total'
    
    def temps_service(self, obj):
        if obj.heure_serve and obj.heure_commande:
            diff = obj.heure_serve - obj.heure_commande
            minutes = diff.total_seconds() / 60
            return f"{minutes:.1f} min"
        return "-"
    temps_service.short_description = 'Temps service'
