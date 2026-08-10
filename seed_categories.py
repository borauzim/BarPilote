import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'barpilote.settings')
django.setup()

from proprietaire.models import Category

categories = [
    {"nom": "Bières", "icon": "sports_bar"},
    {"nom": "Spiritueux", "icon": "liquor"},
    {"nom": "Softs & Jus", "icon": "local_drink"},
    {"nom": "Cocktails", "icon": "cocktail"},
    {"nom": "Vins", "icon": "wine_bar"},
    {"nom": "Champagnes", "icon": "liquor"},
]

for cat in categories:
    obj, created = Category.objects.get_or_create(nom=cat["nom"], defaults={"icon": cat["icon"]})
    if created:
        print(f"Catégorie créée : {cat['nom']}")
    else:
        print(f"Catégorie existante : {cat['nom']}")
