from django.core.management.base import BaseCommand
from django.db import transaction

from proprietaire.models import Category, MasterProduct


CATEGORY_PRODUCTS = {
    "Bière blonde": (
        "33 Export", "Beaufort Lager", "Beaufort Lager — verre", "Castel Beer",
        "Chui", "Class Premium", "Class Premium — verre", "Heineken",
        "Mützig Lager — verre", "Nkoyi Blonde", "Peak 5.5", "Peak 7.7",
        "Primus", "Simba", "Skol",
    ),
    "Bière brune": (
        "Chui Black", "Doppel Munich", "Doppel Munich — verre", "Guinness",
        "Legend Extra Stout", "Nkoyi Black", "Nkoyi Black — verre", "Tembo",
        "Tembo — verre", "Turbo King",
    ),
    "Boisson maltée sans alcool": ("Amstel Malta", "Maltina", "Maltina — canette", "Maltina — verre"),
    "Cidre": ("Booster Cider",),
    "Cocktail alcoolisé": (
        "Booster Gin Tonic", "Booster Whisky Cola", "Exo Vodka Energy Mix 18%",
        "Exo Vodka Energy Mix 22%", "Racines", "Smirnoff Ice Double Black",
        "Smirnoff Ice Pineapple", "Vody Vodka Energy 18%", "Vody Vodka Energy 22%",
    ),
    "Cognac": ("Hennessy V.S", "Martell VS"),
    "Eau plate": ("Cristal", "Swissta"),
    "Eau gazeuse": ("Eau Vive gazeuse",),
    "Gin": ("Gordon's London Dry Gin",),
    "Jus de fruits": ("Ceres Ananas", "Ceres Orange", "Ceres Pomme"),
    "Liqueur": ("Amarula", "Baileys Original"),
    "Soda": (
        "Coca-Cola — PET", "Coca-Cola — canette", "Coca-Cola — verre",
        "D’jino Ananas", "D’jino Grenadine", "D’jino Orange", "D’jino Tonic",
        "D’jino Tropical", "Fanta Orange — PET", "Fanta Orange — canette",
        "Fanta Orange — verre", "Sprite — PET", "Sprite — canette", "Sprite — verre",
        "TOP Grenadine", "TOP Orange", "TOP Tropical", "Vitalo Grenadine — PET",
        "Vitalo Grenadine — verre", "World Cola", "Youzou",
    ),
    "Vodka": ("Absolut Vodka",),
    "Whisky": (
        "Jack Daniel's Old No. 7", "Jameson Irish Whiskey", "Johnnie Walker Red Label",
        "Whisky Label 5", "William Lawson's",
    ),
    "Vin": (
        "Don Simon Blanc", "Don Simon Sangria", "Mouton Cadet Blanc",
        "Mouton Cadet Rouge", "Nederburg Blanc", "Nederburg Rosé",
    ),
    "Champagne": ("Moët & Chandon Impérial Brut",),
    "Boisson énergisante": ("Energy Malt", "Energy Malt — canette", "Energy Malt — verre", "Red Bull", "XXL Energy"),
}


class Command(BaseCommand):
    help = "Classe chaque produit du catalogue dans une catégorie précise et cohérente."

    @transaction.atomic
    def handle(self, *args, **options):
        updated = 0
        for category_name, product_names in CATEGORY_PRODUCTS.items():
            category, _ = Category.objects.get_or_create(nom=category_name)
            updated += MasterProduct.objects.filter(nom__in=product_names).exclude(
                categorie=category
            ).update(categorie=category)

        used_ids = set(MasterProduct.objects.values_list("categorie_id", flat=True))
        removed, _ = Category.objects.exclude(id__in=used_ids).delete()
        self.stdout.write(self.style.SUCCESS(
            f"Catégories normalisées : {updated} produit(s) reclassé(s), "
            f"{removed} catégorie(s) vide(s) supprimée(s)."
        ))
