# Espace proprietaire

L'app `proprietaire` contient le coeur de BarPilote. Elle sert a configurer un etablissement, gerer le stock, suivre les commandes, administrer l'equipe, consulter les finances et produire les factures.

## Acces

Routes HTML principales :

- `/proprietaire/dashboard/` : tableau de bord.
- `/proprietaire/profile-setup/` : profil du proprietaire.
- `/proprietaire/setup-bar/` : creation de l'etablissement.
- `/proprietaire/setup-bar/details/` : details du bar.
- `/proprietaire/setup-bar/tables/` : creation initiale des tables.
- `/proprietaire/inventory/` : inventaire et produits.
- `/proprietaire/finance/` : ventes, pertes, dettes, factures et rapports.
- `/proprietaire/team/` : serveurs, demandes et permissions.
- `/proprietaire/tables/` : gestion des tables et QR codes.
- `/proprietaire/clients/` : historique client et autorisations de dette.

Les API REST sont exposees sous `/api/proprietaire/`.

## Ce que le proprietaire peut faire

- Creer un bar, lounge, club, restaurant ou evenement.
- Renseigner le logo, l'adresse, le taux de change et les informations de facturation.
- Creer plusieurs tables et telecharger les QR codes.
- Ajouter les produits du catalogue au stock du bar.
- Definir les prix d'achat, prix de vente, devise, seuil d'alerte et vente au verre.
- Enregistrer des arrivages de stock et des pertes.
- Suivre les commandes client en direct.
- Changer les statuts de commande : en attente, acceptee, preparation, servi, paye ou annule.
- Transformer une commande en facture ou en dette client.
- Gerer les clients connus et leur droit a la dette.
- Consulter les statistiques de vente, marges, impayes et mouvements.
- Inviter des serveurs et accepter ou refuser leurs demandes.
- Donner des acces precis aux serveurs : inventaire, tables, rapports.

## Parcours typique

1. Le proprietaire se connecte via `/auth/login/`.
2. S'il n'a pas encore de role, il choisit `PROPRIETAIRE`.
3. Il complete son profil dans `profile-setup`.
4. Il cree son etablissement dans `setup-bar`.
5. Il ajoute les details du bar, puis les tables.
6. Il configure l'inventaire et les prix.
7. Il imprime ou telecharge les QR codes des tables.
8. Les clients commandent via les QR codes.
9. Le proprietaire supervise les commandes, les paiements, les dettes et les factures.

## Gestion du stock

Le stock du bar est represente par `StockItem`. Chaque ligne relie un produit global (`MasterProduct`) a un bar.

Elements geres :

- quantite actuelle ;
- seuil d'alerte ;
- prix d'achat unitaire ;
- prix d'achat par casier ;
- nombre de bouteilles par casier ;
- prix de vente unitaire ;
- vente au verre ;
- devise USD ou CDF.

Lorsqu'un arrivage (`StockSupply`) est enregistre, la quantite en stock augmente automatiquement. Lorsqu'une vente (`Sale`) est creee, le stock est diminue.

## Tables et QR codes

Chaque `Table` appartient a un `Bar`. Son lien client est construit avec la route :

```text
/client/<table_id>/
```

Ce lien est encode dans le QR code. Quand un client le scanne, il arrive directement sur le menu de la table.

## Commandes et factures

Une commande est stockee dans `Order`. Les produits de la commande sont stockes dans `OrderItem`.

Statuts possibles :

- `PENDING` : commande recue.
- `ACCEPTEE` : commande acceptee.
- `PREPARING` : preparation en cours.
- `SERVED` : commande servie.
- `PAID` : commande payee.
- `CANCELLED` : commande annulee.

Les factures utilisent le modele `Facture`. Elles peuvent representer une dette client ou une depense fournisseur. Les PDF peuvent etre telecharges depuis l'espace finances.

## Equipe

Les serveurs rejoignent un bar grace a un code ou un lien d'invitation. Le proprietaire voit les demandes dans l'espace equipe et peut :

- confirmer un serveur ;
- rejeter une demande ;
- activer ou desactiver un serveur ;
- autoriser l'acces a l'inventaire ;
- autoriser l'acces aux tables ;
- autoriser l'acces aux rapports.

## Fichiers importants

- `models.py` : modeles de bar, profil, tables, stock, commandes, factures, clients et notifications.
- `html_views.py` : vues HTML de l'espace proprietaire.
- `api_views.py` : API REST.
- `html_urls.py` : routes HTML.
- `urls.py` : routes API.
- `templates/proprietaire/` : pages HTML proprietaire.

