from django.core.management.base import BaseCommand

from proprietaire.models import Category, MasterProduct


PRODUCTS = (
    ("Absolut Vodka", "Vodka", "70cl", 70, "absolut-vodka-70cl.jpg", "Vodka Absolut en bouteille de 70 cl."),
    ("Amarula", "Liqueur", "75cl", 75, "amarula-75cl.jpg", "Liqueur crémeuse Amarula en bouteille de 75 cl."),
    ("Baileys Original", "Liqueur", "75cl", 75, "baileys-75cl.jpg", "Liqueur Baileys Original Irish Cream en bouteille de 75 cl."),
    ("Ceres Orange", "Jus de fruits", "1L", 100, "ceres-orange-1l.png", "Jus de fruits Ceres à l'orange en brique de 1 litre."),
    ("Ceres Pomme", "Jus de fruits", "1L", 100, "ceres-pomme-1l.png", "Jus de fruits Ceres à la pomme en brique de 1 litre."),
    ("Ceres Ananas", "Jus de fruits", "1L", 100, "ceres-ananas-1l.png", "Jus de fruits Ceres à l'ananas en brique de 1 litre."),
    ("Don Simon Sangria", "Vin", "1L", 100, "don-simon-sangria-1l.png", "Sangria Don Simon en conditionnement de 1 litre."),
    ("Don Simon Blanc", "Vin", "75cl", 75, "don-simon-blanc-75cl.png", "Vin blanc Don Simon en bouteille de 75 cl."),
    ("Gordon's London Dry Gin", "Vins & Spiritueux", "75cl", 75, "gordons-dry-gin-75cl.jpg", "Gin Gordon's London Dry en bouteille de 75 cl."),
    ("Jack Daniel's Old No. 7", "Whiskies", "1L", 100, "jack-daniels-old-no7-1l.png", "Tennessee whiskey Jack Daniel's Old No. 7 en bouteille de 1 litre."),
    ("Jameson Irish Whiskey", "Whiskies", "75cl", 75, "jameson-75cl.jpg", "Whiskey irlandais Jameson en bouteille de 75 cl."),
    ("Legend Extra Stout", "Bière brune", "33cl", 33, "legend-extra-stout-33cl.jpg", "Bière stout brune Legend Extra Stout de BRALIMA en bouteille de 33 cl."),
    ("Legend Extra Stout", "Bière brune", "50cl", 50, "legend-extra-stout-33cl.jpg", "Bière stout brune Legend Extra Stout de BRALIMA en bouteille de 50 cl."),
    ("Martell VS", "Vins & Spiritueux", "70cl", 70, "martell-vs-70cl.png", "Cognac Martell VS en bouteille de 70 cl."),
    ("Moët & Chandon Impérial Brut", "Champagne", "37,5cl", 38, "moet-imperial-brut-375ml.png", "Champagne Moët & Chandon Impérial Brut en demi-bouteille."),
    ("Mouton Cadet Rouge", "Vin", "75cl", 75, "mouton-cadet-rouge-75cl.png", "Vin rouge Mouton Cadet en bouteille de 75 cl."),
    ("Mouton Cadet Blanc", "Vin", "75cl", 75, "mouton-cadet-blanc-75cl.png", "Vin blanc Mouton Cadet en bouteille de 75 cl."),
    ("Nederburg Rosé", "Vin", "75cl", 75, "nederburg-rose-75cl.png", "Vin rosé sud-africain Nederburg en bouteille de 75 cl."),
    ("Nederburg Blanc", "Vin", "75cl", 75, "nederburg-blanc-75cl.png", "Vin blanc sud-africain Nederburg en bouteille de 75 cl."),
    ("Red Bull", "Énergisant", "25cl", 25, "red-bull-25cl.jpg", "Boisson énergisante Red Bull en canette de 25 cl."),
    ("Smirnoff Ice Double Black", "Cocktail", "33cl", 33, "smirnoff-ice-double-black-33cl.png", "Boisson alcoolisée prête à boire Smirnoff Ice Double Black."),
    ("Smirnoff Ice Pineapple", "Cocktail", "33cl", 33, "smirnoff-ice-pineapple-33cl.png", "Boisson alcoolisée prête à boire Smirnoff Ice Pineapple."),
    ("Swissta", "Eau", "1,5L", 150, "swissta-150cl.jpg", "Eau minérale Swissta en bouteille de 1,5 litre."),
    ("Vitalo Grenadine", "Soda", "30cl", 30, "vitalo-grenadine-30cl.jpg", "Boisson gazeuse Vitalo saveur grenadine."),
    ("William Lawson's", "Whiskies", "75cl", 75, "william-lawsons-75cl.jpg", "Blended Scotch whisky William Lawson's en bouteille de 75 cl."),
)


class Command(BaseCommand):
    help = "Ajoute au catalogue les boissons RDC vérifiées et leurs photos locales."

    def handle(self, *args, **options):
        created = 0
        updated = 0

        # Corriger la catégorie générique qui masquait Tembo dans le filtre des brunes.
        brown_beer, _ = Category.objects.get_or_create(nom="Bière brune")
        MasterProduct.objects.filter(nom__iexact="Tembo").update(categorie=brown_beer)

        for name, category_name, volume, volume_cl, filename, description in PRODUCTS:
            category, _ = Category.objects.get_or_create(nom=category_name)
            defaults = {
                "categorie": category,
                "volume_cl": volume_cl,
                "format_casier": "PETIT" if volume_cl <= 33 else "GROS",
                "photo": f"master_products/expanded_catalogue/{filename}",
                "description": description,
            }
            product, was_created = MasterProduct.objects.get_or_create(
                nom=name,
                volume=volume,
                defaults=defaults,
            )
            if was_created:
                created += 1
                continue

            changed = False
            for field, value in defaults.items():
                current = getattr(product, field)
                if field == "photo":
                    current = str(current or "")
                if current != value:
                    setattr(product, field, value)
                    changed = True
            if changed:
                product.save()
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Catalogue RDC synchronisé : {created} ajout(s), {updated} mise(s) à jour."
        ))
