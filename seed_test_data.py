import os
import django
import random
from datetime import timedelta
from django.utils import timezone
from decimal import Decimal

# Configuration de l'environnement Django
# (À lancer via: python manage.py shell < seed_test_data.py)

from proprietaire.models import (
    Bar, Table, Category, MasterProduct, StockItem, 
    Sale, PilotProfile, StaffShift, Order
)

def seed_data():
    print("🚀 Démarrage de la simulation de données BarPilote...")
    
    # 1. Sélection du Bar
    bar = Bar.objects.first()
    if not bar:
        print("❌ Erreur: Aucun bar trouvé. Créez un bar d'abord via l'onboarding.")
        return
    print(f"📍 Établissement cible: {bar.nom}")

    # 2. Création des Catégories
    cat_biere, _ = Category.objects.get_or_create(nom="Bières", defaults={'icon': 'liquor'})
    cat_soft, _ = Category.objects.get_or_create(nom="Soft Drinks", defaults={'icon': 'local_drink'})
    cat_vin, _ = Category.objects.get_or_create(nom="Vins & Spiritueux", defaults={'icon': 'wine_bar'})

    # 3. Création des Produits Référentiels
    products = [
        ("Primus", cat_biere, "50cl", 1.5, 2.5),
        ("Heineken", cat_biere, "33cl", 2.0, 4.0),
        ("Coca-Cola", cat_soft, "33cl", 0.7, 1.5),
        ("Whisky Label 5", cat_vin, "75cl", 15.0, 25.0)
    ]

    stock_items = []
    for p_name, p_cat, p_vol, p_cost, p_price in products:
        master, _ = MasterProduct.objects.get_or_create(
            nom=p_name, categorie=p_cat, defaults={'volume': p_vol}
        )
        item, created = StockItem.objects.get_or_create(
            bar=bar, produit=master,
            defaults={
                'quantite_actuelle': 100,
                'prix_achat_unitaire': p_cost,
                'prix_vente_unitaire': p_price,
                'devise': 'USD'
            }
        )
        stock_items.append(item)
        if created: print(f"✅ Stock créé: {p_name}")

    # 4. Simulation de l'Équipe (Shift)
    server = PilotProfile.objects.filter(role='SERVEUR', bar=bar).first()
    if server:
        shift, _ = StaffShift.objects.get_or_create(
            worker=server, bar=bar, status='ACTIVE',
            defaults={'start_time': timezone.now() - timedelta(hours=4)}
        )
        print(f"👥 Serveur en service: {server.prenom}")

    # 5. Simulation des Ventes (Aujourd'hui, réparties par heure)
    tables = Table.objects.filter(bar=bar)
    if not tables.exists():
        print("❌ Aucune table trouvée. Créez des tables d'abord.")
        return

    now = timezone.now()
    total_sales_created = 0
    
    # On crée des ventes sur les 6 dernières heures
    for h in range(6):
        time_offset = now - timedelta(hours=h)
        # Nombre de ventes par heure (aléatoire entre 2 et 5)
        for _ in range(random.randint(2, 5)):
            target_table = random.choice(tables)
            target_item = random.choice(stock_items)
            
            Sale.objects.create(
                bar=bar,
                table=target_table,
                item=target_item,
                quantite=random.randint(1, 4),
                prix_unitaire_applique=target_item.prix_vente_unitaire,
                devise='USD',
                date_vente=time_offset
            )
            total_sales_created += 1

    print(f"💰 Simulation terminée: {total_sales_created} ventes générées sur {tables.count()} tables.")
    print("📈 Votre Cockpit est maintenant vivant !")

if __name__ == "__main__":
    seed_data()
