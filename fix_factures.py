import os
import django
from django.utils import timezone
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'barpilote.settings')
django.setup()

from proprietaire.models import Facture, Order

# Supprimer toutes les factures existantes pour repartir à zéro proprement
Facture.objects.all().delete()
print("🗑️ Anciennes factures supprimées.")

# Récupérer toutes les commandes payées
paid_orders = Order.objects.filter(statut='PAID').order_by('date_creation')

# Grouper par Table et par Date (jour) pour éviter de générer 50 factures si une table a commandé 50 fois
factures_a_creer = {}

for order in paid_orders:
    bar = order.bar
    table_nom = order.table.nom if order.table else "Comptoir"
    date_jour = order.date_creation.date()
    
    group_key = f"{bar.id}_{table_nom}_{date_jour}"
    
    if group_key not in factures_a_creer:
        client_name = order.client_name or ""
        client_phone = order.client_phone or ""
        
        if client_name and client_phone:
            client_nom_complet = f"{client_name} ({client_phone})"
        elif client_name:
            client_nom_complet = client_name
        elif client_phone:
            client_nom_complet = f"Client {client_phone}"
        else:
            client_nom_complet = f"Client - {table_nom}"

        short_uuid = str(uuid.uuid4())[:4].upper()
        numero_facture = f"FAC-{date_jour.strftime('%y%m%d')}-{short_uuid}"

        factures_a_creer[group_key] = {
            'bar': bar,
            'numero': numero_facture,
            'client_fournisseur': client_nom_complet,
            'montant_usd': 0,
            'montant_cdf': 0,
            'type_facture': 'CLIENT',
            'statut': 'PAYEE',
            'description': f"Rétro-Facturation pour la {table_nom} le {date_jour.strftime('%d/%m/%Y')}",
            'date_emission': order.date_creation, # Utiliser le datetime exact de la première commande
            'orders': [],
            'order_count': 0
        }
    
    factures_a_creer[group_key]['montant_usd'] += order.total_usd
    factures_a_creer[group_key]['montant_cdf'] += order.total_cdf
    factures_a_creer[group_key]['orders'].append(order)
    factures_a_creer[group_key]['order_count'] += 1

# Création en base de données et liaison ManyToMany
for key, data in factures_a_creer.items():
    facture = Facture(
        bar=data['bar'],
        numero=data['numero'],
        client_fournisseur=data['client_fournisseur'],
        montant_usd=data['montant_usd'],
        montant_cdf=data['montant_cdf'],
        type_facture=data['type_facture'],
        statut=data['statut'],
        notes=f"{data['description']} ({data['order_count']} commande(s))"
    )
    facture.save()
    
    # Lier les commandes
    facture.orders.set(data['orders'])
    
    # Forcer la date_emission qui est en auto_now_add
    facture.date_emission = data['date_emission']
    facture.save()
    print(f"✅ Facture générée et liée : {facture.numero} ({facture.montant_usd}$ / {facture.montant_cdf}FC) - {len(data['orders'])} commande(s)")

print("Terminé !")
