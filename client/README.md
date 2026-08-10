# Espace client

L'app `client` est le parcours public utilise par les clients du bar. Le client n'a pas besoin de compte. Il scanne le QR code d'une table, consulte le menu, envoie sa commande, suit son statut et peut retrouver ses factures.

## Acces

Routes publiques :

- `/client/<table_id>/` : menu de la table.
- `/client/<table_id>/history/` : historique des commandes vues dans la session du client.
- `/client/<table_id>/invoices/` : factures liees aux commandes du client.
- `/client/order/<order_id>/` : suivi d'une commande.
- `/client/order/<order_id>/action/` : actions client sur une commande.
- `/client/order/<order_id>/invoice/` : telechargement de facture.
- `/client/api/order/<order_id>/status/` : statut JSON de la commande.

## Parcours client

1. Le client scanne le QR code place sur sa table.
2. Le lien ouvre `/client/<table_id>/`.
3. Le menu affiche les produits disponibles pour le bar de cette table.
4. Le client choisit les quantites et le type de vente si disponible : bouteille ou verre.
5. Il renseigne ses informations si demandees.
6. L'application cree une `Order` et des `OrderItem`.
7. La commande apparait chez le proprietaire et les serveurs.
8. Le client suit l'avancement sur `/client/order/<order_id>/`.
9. Apres paiement ou dette, la facture peut etre consultee ou telechargee.

## Suivi de commande

Les statuts visibles suivent la commande :

- recue ;
- acceptee ;
- en preparation ;
- servie ;
- payee ;
- annulee si la commande est arretee.

La route API `/client/api/order/<order_id>/status/` permet a l'interface de recuperer l'etat de la commande sans recharger toute la page.

## Session client

Le client n'a pas de compte. L'application memorise les commandes dans la session du navigateur :

- `client_order_<table_id>` garde la commande active.
- `client_orders_<table_id>` garde l'historique recent.

Cela permet au client de retrouver ses commandes depuis le meme telephone tant que la session existe.

## Paiement, dette et facture

Le modele `ClientOrderMeta` ajoute des informations autour de la commande :

- postnom et prenom du client ;
- note ou demande speciale ;
- demande de dette ;
- raison de dette ;
- demande de paiement ;
- devise de paiement ;
- montant converti ;
- confirmation du paiement par un membre du bar.

Quand une facture est necessaire, elle est creee depuis la commande avec le modele `Facture` de l'app `proprietaire`.

## Avis client

Le modele `ClientServiceRating` permet d'enregistrer une note sur :

- le serveur ;
- le bar ;
- un commentaire libre.

## Fichiers importants

- `views.py` : menu, creation de commande, suivi, actions client, factures et API statut.
- `models.py` : metadonnees de commande client et avis de service.
- `urls.py` : routes publiques client.
- `templates/client/` : pages HTML client.

