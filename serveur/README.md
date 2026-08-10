# Espace serveur

L'app `serveur` gere le parcours des serveurs. Un serveur peut rejoindre un bar, attendre la confirmation du proprietaire, recevoir les commandes, gerer son service et consulter certaines sections selon les permissions donnees.

## Acces

Routes HTML principales :

- `/serveur/scan/` : scanner ou saisir un code d'invitation.
- `/serveur/join/<code>/` : rejoindre un bar depuis un lien d'invitation.
- `/serveur/setup/` : completer le profil serveur.
- `/serveur/welcome/` : page d'accueil apres configuration.
- `/serveur/waiting-confirmation/` : attente de validation par le proprietaire.
- `/serveur/dashboard/` : tableau de bord serveur.
- `/serveur/take-order/` : prise de commande.
- `/serveur/commande/<order_id>/` : detail d'une commande.
- `/serveur/mission/<order_id>/` : mission de service liee a une commande.
- `/serveur/shift/` : debut, pause ou fin de service.
- `/serveur/inventory/` : inventaire si autorise.
- `/serveur/tables/` : tables si autorise.
- `/serveur/reports/` : rapports si autorise.
- `/serveur/finance/` : finances si l'acces est disponible.
- `/serveur/clients/` : clients et historique.

## Comment un serveur rejoint un bar

1. Le proprietaire genere un code ou un PDF d'invitation.
2. Le serveur ouvre `/serveur/scan/` ou un lien `/serveur/join/<code>/`.
3. Il complete son profil dans `/serveur/setup/`.
4. Son statut devient `PENDING`.
5. Le proprietaire confirme ou rejette la demande depuis `/proprietaire/team/`.
6. Apres confirmation, le serveur accede au tableau de bord.

## Statuts et permissions

Le modele `ServeurProfile` contient le statut de confirmation :

- `PENDING` : en attente de confirmation.
- `CONFIRMED` : confirme par le proprietaire.
- `REJECTED` : rejete.

Il contient aussi des permissions separees :

- `inventory_access_granted` : acces a l'inventaire.
- `tables_access_granted` : acces aux tables.
- `reports_access_granted` : acces aux rapports.

Les methodes `can_access_inventory()`, `can_access_tables()` et `can_access_reports()` verifient que le serveur est confirme avant d'autoriser ces sections.

## Travail quotidien

Depuis le dashboard, le serveur peut :

- voir les commandes de son bar ;
- ouvrir le detail d'une commande ;
- accepter, preparer, servir ou cloturer une commande selon les actions disponibles ;
- prendre une commande manuelle ;
- consulter son historique de clients ;
- signaler une perte de stock ;
- gerer son quart de travail.

Les quarts de travail sont suivis avec `Shift` et utilisent les statuts :

- `ACTIVE` : en service ;
- `BREAK` : en pause ;
- `ENDED` : termine.

## Commandes

Les commandes client principales viennent du modele `Order` de l'app `proprietaire`. L'espace serveur travaille sur ces commandes pour suivre le service en salle.

Le modele `CommandeServeur` existe aussi pour representer des commandes gerees cote serveur avec numero, table, statut, totaux et horaires.

## Relations avec le proprietaire

Le proprietaire garde le controle :

- il confirme ou rejette les serveurs ;
- il active ou desactive les acces ;
- il voit les commandes et les performances ;
- il recoit les informations de pertes, paiements et dettes.

## Fichiers importants

- `models.py` : profils serveurs, codes d'invitation, shifts et commandes serveur.
- `html_views.py` : vues HTML serveur.
- `html_urls.py` : routes HTML serveur.
- `urls.py` : routes API serveur.
- `templates/serveur/` : pages HTML serveur.
- `invitations.py` : logique d'invitation.

