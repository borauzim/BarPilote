from django.contrib import admin

from .models import EmailLoginCode


@admin.register(EmailLoginCode)
class EmailLoginCodeAdmin(admin.ModelAdmin):
    list_display = ('email', 'created_at', 'expires_at', 'used_at', 'attempts')
    search_fields = ('email',)
    readonly_fields = ('email', 'code_hash', 'created_at', 'expires_at', 'used_at', 'attempts')
