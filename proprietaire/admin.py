from django.contrib import admin
from .models import Bar, PilotProfile, Table

@admin.register(Bar)
class BarAdmin(admin.ModelAdmin):
    list_display = ('nom', 'adresse', 'date_creation')
    search_fields = ('nom',)

@admin.register(PilotProfile)
class PilotProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'postnom', 'bar', 'sexe', 'telephone')
    list_filter = ('sexe', 'bar')
    search_fields = ('user__username', 'postnom')

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('nom', 'bar', 'est_active', 'date_creation')
    list_filter = ('est_active', 'bar')
    search_fields = ('nom',)
