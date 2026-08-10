from allauth.socialaccount.models import SocialApp
from django.contrib.sites.models import Site

# Synchronisation de l'application Google
app, created = SocialApp.objects.get_or_create(provider='google')
app.name = 'Google Auth'
app.client_id = '430702577903-3uj9eqdh30ag2l2cehv0ljsgo1f5memg.apps.googleusercontent.com'
app.secret = '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'
app.save()

# S'assurer que l'application est liée au site par défaut
site = Site.objects.get_or_create(domain='localhost:8000', name='localhost')[0]
app.sites.add(site)

print("\n" + "="*40)
print("✅ AUTHENTIFICATION GOOGLE SYNCHRONISÉE !")
print(f"ID: {app.client_id}")
print(f"Secret: {app.secret[:8]}...")
print("="*40 + "\n")
