# BarPilote

BarPilote est une application Django pour piloter un bar, lounge, restaurant ou evenement depuis trois espaces principaux :

- `proprietaire` : gestion de l'etablissement, du stock, des tables, des finances, des factures, des clients et de l'equipe.
- `serveur` : espace de travail du serveur pour rejoindre un bar, recevoir les commandes, servir les tables et consulter les sections autorisees.
- `client` : parcours public accessible par QR code de table pour voir le menu, commander, suivre la commande et retrouver les factures.

## Comment l'application est organisee

Le projet principal est dans `barpilote/`. Les routes globales sont declarees dans `barpilote/urls.py`.

Routes importantes :

- `/` redirige l'utilisateur connecte vers son espace selon son role.
- `/auth/login/` affiche la connexion.
- `/auth/select-role/` permet de choisir le role apres connexion.
- `/proprietaire/dashboard/` ouvre le tableau de bord proprietaire.
- `/serveur/dashboard/` ouvre le tableau de bord serveur.
- `/client/<table_id>/` ouvre le menu public d'une table.
- `/api/proprietaire/` expose les API REST proprietaire.
- `/api/serveur/` expose les API REST serveur.

## Parcours general

1. Le proprietaire se connecte, complete son profil et cree son etablissement.
2. Il configure les details du bar, les tables, le stock, les prix et les acces de son equipe.
3. Chaque table possede un lien client public et un QR code.
4. Le client scanne le QR de sa table, choisit des produits et envoie une commande.
5. Les serveurs et le proprietaire voient la commande en temps reel, changent son statut et gerent le service.
6. Quand la commande est payee ou transformee en dette, les factures et les finances sont mises a jour.

## Donnees principales

- `Bar` : etablissement, adresse, type, logo, taux de change, abonnement et tables.
- `PilotProfile` : profil utilisateur interne, role, bar actif, etablissements possedes, devise preferee.
- `Table` : table physique avec lien menu client et QR code.
- `Category` et `MasterProduct` : catalogue de produits.
- `StockItem` et `StockSupply` : inventaire, prix, arrivages, seuils et vente au verre.
- `Order` et `OrderItem` : commande client et lignes de produits.
- `Sale` : vente qui decompte le stock.
- `Facture` : dette client ou depense fournisseur.
- `Notification` et `FCMDeviceToken` : notifications internes et push web.

## Installation rapide

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py runserver
```

Avec les WebSockets et notifications temps reel, l'application peut aussi tourner avec Daphne :

```bash
python3 -m daphne barpilote.asgi:application
```

## Documentation par role

- [README proprietaire](proprietaire/README.md)
- [README serveur](serveur/README.md)
- [README client](client/README.md)

