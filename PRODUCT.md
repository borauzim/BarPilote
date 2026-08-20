# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Les propriétaires et gérants de bars, lounges et restaurants pilotent leur établissement, leur stock, leurs ventes, leurs finances, leurs clients et leur équipe.
- Les serveurs rejoignent un établissement, reçoivent et traitent les commandes, servent les tables et consultent les fonctions qui leur sont autorisées.
- Les clients utilisent un parcours public mobile après avoir scanné le QR code d'une table pour consulter le menu, commander, suivre leur commande et retrouver leurs factures.

## Product Purpose

BarPilote centralise l'exploitation quotidienne d'un établissement afin de relier le service en salle, les commandes, les paiements, le stock et les finances. Le produit doit rendre les opérations plus rapides et traçables, donner au propriétaire une vision exploitable en temps réel et réduire les erreurs et pertes opérationnelles.

## Positioning

BarPilote relie dans un même flux opérationnel le QR code physique de chaque table, la commande autonome du client, le traitement par le serveur, la mise à jour du stock et le suivi financier du propriétaire. Cette continuité entre salle et gestion est le mécanisme central du produit.

## Operating Context

- Le propriétaire configure son profil, son établissement, ses tables, son catalogue, ses prix, son stock et les accès de son équipe.
- Chaque table dispose d'un lien public et d'un QR code.
- Le client commande depuis son téléphone sans créer un parcours administratif lourd.
- Le serveur et le propriétaire reçoivent les commandes en temps réel et font évoluer leur statut jusqu'au service et au règlement.
- Une commande réglée ou convertie en dette alimente les factures et le suivi financier.
- L'usage est mobile-first pour les serveurs et clients, avec des vues de pilotage plus denses pour les propriétaires.

## Capabilities and Constraints

- Application Django avec templates serveur, API REST, WebSockets via Channels/Daphne, notifications web et push, PWA et enveloppe Capacitor Android/iOS.
- Trois espaces fonctionnels distincts : `proprietaire`, `serveur` et `client`, plus l'authentification partagée.
- Gestion multi-établissements, tables, catalogue, stock, arrivages, pertes, commandes, ventes, factures, dettes, équipe, salaires et notifications selon les capacités présentes dans le dépôt.
- Les devises CDF et USD et le taux de change font partie du domaine produit.
- La distribution Android/iOS actuelle enveloppe l'application web : le langage d'interface reste donc web et responsive.
- La fidélité, la gamification, BarPilote Events et certains mécanismes antifraude décrits dans les documents de conception restent des orientations ou décisions ouvertes tant qu'ils ne sont pas confirmés par l'implémentation.

## Brand Commitments

- Le nom produit est **BarPilote**.
- La langue principale de l'interface est le français.
- Les logos et icônes existants se trouvent notamment dans `static/`, `logo.png` et les ressources mobiles.
- La refonte demandée doit produire une interface SaaS moderne, professionnelle, responsive et cohérente dans les trois espaces, sans changer les workflows métier ni inventer de nouvelles promesses produit.

## Evidence on Hand

- Documentation produit et parcours : `README.md`, `proprietaire/README.md`, `serveur/README.md`, `client/README.md`.
- Brief et PRD existants : `_bmad-output/analysis/product-brief-barpilote.md` et `_bmad-output/analysis/prd.md`.
- Implémentation fonctionnelle dans les applications Django `proprietaire`, `serveur`, `client` et `authentification`.
- Logos, icônes, photos et visuels de produits présents dans `static/`, `media/`, `assets/` et les dossiers de mockups.
- Aucun témoignage client, benchmark public ou preuve commerciale ne doit être fabriqué.

## Product Principles

1. Rendre l'état du bar compréhensible en quelques secondes, puis permettre d'agir sans détour.
2. Maintenir une chaîne de traçabilité claire entre table, commande, service, paiement, stock et finances.
3. Adapter la densité et les priorités de l'interface au rôle : décider pour le propriétaire, exécuter pour le serveur, commander simplement pour le client.
4. Concevoir d'abord pour les conditions réelles d'usage mobile en salle, sans sacrifier l'efficacité du poste de gestion.
5. Préserver les données, permissions et workflows métier existants pendant toute évolution de l'interface.

## Accessibility & Inclusion

L'interface doit rester utilisable au clavier, conserver des contrastes lisibles, fournir des états de focus visibles et ne pas dépendre uniquement de la couleur pour communiquer un statut. Les interactions prioritaires des parcours serveur et client doivent être accessibles sur petit écran et avec une cible tactile confortable.
