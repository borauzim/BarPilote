from django.apps import AppConfig

class ProprietaireConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'proprietaire'
    verbose_name = "Module Propriétaires"

    def ready(self):
        import proprietaire.signals  # noqa: F401
