import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'barpilote.settings')
django.setup()

from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp

def seed_social_app():
    # Purge complète pour éviter les conflits de domaine unique ou d'ID
    from django.contrib.sites.models import Site
    Site.objects.all().delete()
    site = Site.objects.create(id=1, domain='localhost:8000', name='localhost')
    print(f"Site reconfiguré à neuf (ID: {site.id}, Domaine: {site.domain})")

    # Récupérer les clés depuis settings ou les mettre en dur pour être sûr
    client_id = '1096537323559-8i3ijevjqaok39o7qbgodanppto6k6ma.apps.googleusercontent.com'
    secret = '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'

    # Créer l'application sociale
    app, created = SocialApp.objects.get_or_create(
        provider='google',
        name='Google Auth BarPilote',
        client_id=client_id,
        secret=secret
    )
    
    if created:
        print(f"SocialApp 'google' créée avec succès.")
    else:
        print(f"SocialApp 'google' déjà existante. Mise à jour des clés...")
        app.client_id = client_id
        app.secret = secret
        app.save()

    # Lier l'app au site
    app.sites.add(site)
    print(f"SocialApp liée au site {site}.")

if __name__ == "__main__":
    seed_social_app()
