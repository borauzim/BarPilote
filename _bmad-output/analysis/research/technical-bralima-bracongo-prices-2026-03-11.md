# Rapport de Recherche Technique : Tarifs Boissons RDC (Bralima & Bracongo) 🕵️‍♀️📊

**Sujet** : Étude des prix de gros des casiers de boissons pour le paramétrage du module Stock.
**Région** : République Démocratique du Congo (RDC)
**Date** : 11 Mars 2026 (Données basées sur 2024-2025)

## 🍻 Bralima (Heineken NV)
La stabilité a été observée fin 2024 après une forte hausse en début d'année.

| Produit | Format | Prix du Casier (FC) | Note |
| :--- | :--- | :--- | :--- |
| **Primus** | 72 cl | 37 500 FC | Stable (Déc 2024) |
| **Primus** | 50 cl (20 bout.) | 48 400 FC | Donnée Nov 2025 |
| **Turbo King** | 72 cl | 40 000 FC | Donnée Déc 2024 |
| **Turbo King** | 50 cl (20 bout.) | 38 000 FC | Hausse fév 2024 |
| **Heineken** | 33 cl (24 bout.) | 53 000 FC | Donnée Nov 2025 |
| **Legende** | 50 cl | 45 000 FC | |
| **Sodas (Coca/Fanta)** | 30 cl (24 bout.) | 30 000 FC | |
| **Sodas** | 50 cl (20 bout.) | 32 000 FC | |

## 🦁 Bracongo (Groupe Castel)
Le catalogue Bracongo montre une diversification importante avec des prix légèrement supérieurs pour les gammes "Lager".

| Produit | Format | Prix du Casier (FC) | Note |
| :--- | :--- | :--- | :--- |
| **Castel** | 50 cl (20 bout.) | 49 500 FC | Hausse Mai 2024 |
| **Castel** | 65 cl (12 bout.) | 38 000 FC | |
| **Beaufort Lager** | 50 cl (20 bout.) | 52 500 FC | Stable Nov 2025 |
| **33 Export** | 65 cl (12 bout.) | 37 000 FC | |
| **Nkoyi Black** | 50 cl (20 bout.) | 41 000 FC | |
| **Nkoyi Blonde** | 65 cl (12 bout.) | 35 000 FC | |
| **Tembo** | 33 cl (24 bout.) | 50 000 FC | |
| **Doppel Munich** | 50 cl (20 bout.) | 44 000 FC | |
| **Top Soda** | 50 cl (20 bout.) | 27 000 FC | |
| **XXL Energy** | 30 cl (24 bout.) | 30 000 FC | |

## 💡 Implications pour BarPilote (Mary's Analysis)

1. **Calculateur de Marge** : Le système doit utiliser ces prix de gros (Casiers) pour calculer automatiquement le coût unitaire à la bouteille. 
   * *Exemple* : Primus 50cl à 48 400 FC le casier de 20 bouteilles = **2 420 FC / bouteille** (coût de revient).
2. **Gestion Multi-Devises** : Vu la fluctuation du FC, le système devrait permettre de saisir les prix en Dollars ($) avec un taux de change dynamique pour l'affichage en FC.
3. **Alertes de Seuil** : Les augmentations subites (comme en fév/mai 2024) suggèrent qu'une fonctionnalité "Mise à jour globale des prix" est nécessaire pour sauvegarder les marges du propriétaire.

---
*Rapport généré par Mary pour Mapendo-borauzima.*
