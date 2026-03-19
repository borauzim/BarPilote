stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments:
  - /home/mapendo-borauzima/Bureau/barpilote/_bmad-output/analysis/product-brief-barpilote.md
  - /home/mapendo-borauzima/Bureau/barpilote/_bmad-output/analysis/research/technical-bralima-bracongo-prices-2026-03-11.md
  - /home/mapendo-borauzima/Bureau/barpilote/_bmad-output/analysis/research/technical-barpilote-architecture-2026-03-11.md
  - /home/mapendo-borauzima/Bureau/barpilote/_bmad-output/analysis/research/monetization-strategy-barpilote.md
  - /home/mapendo-borauzima/Bureau/barpilote/_bmad-output/brainstorming/brainstorming-session-2026-03-11-1059.md
documentCounts:
  briefCount: 1
  researchCount: 3
  brainstormingCount: 1
  projectDocsCount: 0
classification:
  projectType: Web App (PWA) / SaaS B2B Hybride
  domain: Hospitality & Event Management (Hôtellerie et Événementiel)
  complexity: Medium
  projectContext: Greenfield
workflowType: 'prd'
---

# Product Requirements Document - BarPilote

**Author:** Mapendo-borauzima
**Date:** 2026-03-11

## Executive Summary

BarPilote est une solution de gestion intelligente conçue pour l'hôtellerie (bars, terrasses, lounges) et le secteur évènementiel (mariages, anniversaires) en RDC. Le produit résout deux problèmes critiques : l'absence de visibilité en temps réel sur les stocks, qui paralyse le ravitaillement, et les inefficacités de service (commandes oubliées) qui frustrent les clients et réduisent le chiffre d'affaires. BarPilote s'adresse aux propriétaires d'établissement et aux organisateurs de manifestations cherchant à sécuriser leur exploitation et à gagner en fluidité opérationnelle.

### Ce qui nous rend uniques (Differentiators)

BarPilote se distingue par trois piliers majeurs :
1. **Visibilité "Live Stock"** : Permet aux gestionnaires d'anticiper le ravitaillement en temps réel, évitant les ruptures de stock en plein service.
2. **Excellence du Service** : Élimine les erreurs humaines et les oublis de commandes grâce à une synchronisation temps réel entre les clients et le personnel (Serveurs/Protocoles).
3. **IA de Croissance** : Contrairement aux caisses classiques, BarPilote intègre une intelligence stratégique qui propose des plans d'agrandissement basés sur les données de consommation.
4. **Esthétique "Apple-style"** : Une interface ultra-épurée, minimaliste et premium qui valorise l'établissement.

## Project Classification

- **Project Type**: Web App (PWA) / SaaS B2B Hybride
- **Domain**: Hospitality & Event Management (Hôtellerie et Événementiel)
- **Complexity**: Medium
- **Project Context**: Greenfield

## Success Criteria

### User Success

*   **Patron de Bar** : Réduction immédiate de la fraude de caisse et des pertes de stock. Sentiment de "piloter" son business grâce à la visibilité live.
*   **Serveur (Vigie)** : Meilleure organisation du service, moins de stress lié aux oublis de commandes, et reconnaissance via le ranking "Maître de la Cave".
*   **Invité (Events)** : Expérience fluide sans attente, service impeccable lors des mariages/manifestations.

### Business Success

*   **Monétisation** : Atteindre 3000$ de bénéfice mensuel (cible : 100 bars/évènements actifs à 30$/unité ou taxe dégressive).
*   **Adoption** : Pénétration rapide du marché de Kinshasa grâce à un tarif hyper-accessible (1$ par table/jour).

### Technical Success

*   **Fiabilité** : Fonctionnement 100% offline (PWA) pour pallier l'instabilité du réseau Wi-Fi/4G.
*   **Performance** : Latence de synchronisation des stocks et des commandes inférieure à 500ms.
*   **Sécurité** : Intégrité des transactions garantie par l'identification client et le Badge-Scan serveur.

### Measurable Outcomes

*   Réduction de **15% minimum** des pertes de stock dès le premier mois d'utilisation.
*   Diminution de **30%** du temps de traitement des commandes.
*   Taux de rétention des bars partenaires > 90% après 3 mois.

## Product Scope

### MVP - Minimum Viable Product

*   **Gestion de Stock Hybride** : Conversion automatique Casiers/Bouteilles et Bouteilles/cl (pour spiritueux).
*   **Prise de Commande QR** : Interface client simplifiée (Nom, Prénom, Tel sans vérification).
*   **Interface "Vigie" (Serveur)** : Tableau de bord des commandes filtré par zone/table.
*   **Tableau de bord Patron** : Visibilité du stock live et rapports financiers basiques.
*   **Mode Offline (PWA)** : Support du stockage local et synchro asynchrone.
*   **Mode "Invitations" (Events)** : Gestion de stock pour manifestations avec **affectation du personnel** (assigner X tables à un serveur spécifique).
*   **Boucle de Commande (Loop)** : Possibilité pour le client de programmer une commande récurrente (ex: "X bouteilles toutes les 2 heures").

### Growth Features (Post-MVP)

*   **Rôle "Protocole"** : Gestion spécialisée pour le personnel de manifestation.
*   **Module de Fidélité** : Codes promo et seuils de réduction pour clients réguliers.
*   **Alertes Ravitaillement** : Notifications automatiques basées sur la vitesse de consommation.
*   **Module Gamification** : Ranking interne "Maître de la Cave".

### Vision (Future)

*   **IA Stratégique** : Analyse prédictive pour proposer des plans d'agrandissement et d'optimisation du bar.
*   **Place de Marché** : Connection directe avec les grossistes (Bralima/Bracongo) pour commande de stock via l'app.

## User Journeys

### 1. Jean, l'Invité assoiffé (Le Client)
- **Opening Scene**: Jean s'installe à une table du "Lounge Pilote". Il scanne le QR code posé sur la table.
- **Rising Action**: Pas de formulaire d'inscription fastidieux. Jean tombe directement sur le **Menu Complet** (Bières, Whiskies, Vins).
- **Climax**: Il sélectionne une "Heineken bien frappée" et un "Verre de Chivas". Pour valider, il remplit simplement : *Nom, Postnom, Prénom* et son *Numéro de téléphone*. Il clique sur "Commander en Cash". Son téléphone affiche un **Sceau de Confiance vert** (dynamique) lui confirmant que sa commande est enregistrée.
- **Resolution**: Le serveur arrive 3 minutes plus tard avec les boissons exactes. Jean paye ses 15 000 FC en cash. Il est impressionné par la rapidité.

### 2. Tshala, la Serveuse "Vigie" (Le Serveur)
- **Opening Scene**: Tshala gère 10 tables en terrasse. Elle n'a plus besoin de courir pour prendre les commandes ou de chercher son carnet.
- **Rising Action**: Son smartphone vibre : "Commande Table 4 (Jean)". Elle voit l'heure de la commande et le détail exact.
- **Climax**: Elle prépare le plateau. Avant de servir, elle valide sur son interface pour confirmer qu'elle sort 1 bouteille et 1 verre du stock.
- **Resolution**: Elle sert Jean, récupère le cash, et marque la commande comme "Payée" sur son interface. Le stock se met à jour instantanément pour le patron.

### 3. Grace, l'Ange du Protocole (Le Mode Events)
- **Opening Scene**: Dans un grand mariage, Grace est responsable de la table d'honneur.
- **Rising Action**: Elle utilise BarPilote en **Mode Invitation**. Les invités ne payent rien.
- **Climax**: Chaque fois qu'elle sort une bouteille de Champagne pour les mariés, elle le note sur l'app. Elle sait exactement combien de bouteilles il reste dans le stock de l'organisateur.
- **Resolution**: À la fin de la soirée, elle montre au marié que le stock est conforme. Zéro bouteille n'a "disparu" mystérieusement.

### 4. Papa Mapendo, le Patron Visionnaire (Le Propriétaire)
- **Opening Scene**: Il est chez lui, mais il veut savoir si le samedi soir se passe bien.
- **Rising Action**: Il ouvre son Dashboard. Il voit que 45 Whiskies ont été vendus au verre (cl) et que son stock de Heineken arrive à la limite critique.
- **Climax**: L'IA de BarPilote lui envoie une alerte : "Vitesse de vente élevée : Ravitaillement conseillé pour lundi".
- **Resolution**: Il sait exactement combien d'argent Tshala a collecté en cash. La fraude est impossible car chaque sortie de stock est liée à un client identifié.

### Journey Requirements Summary
- **Client**: Interface Web ultra-légère (PWA), Identification minimale, Menu dynamique.
- **Serveur**: Files d'attente de commandes temps réel, Validation par Badge/PIN, Mode "Payé Cash".
- **Protocole**: Mode "Zéro Facture / Zéro Paiement", Focus inventaire pur.
- **Patron**: Dashboard analytique, Alertes de stock bas, Traçabilité Cash/Identité.

## Domain-Specific Requirements

### Compliance & Regulatory
- **Traçabilité des Recettes** : Enregistrement obligatoire de chaque transaction cash liée à une identité client (Nom/Tel) pour audit interne et conformité fiscale de base.
- **Gestion de la TVA** : Paramétrage flexible des taxes selon le régime fiscal de l'établissement.

### Technical Constraints
- **Résilience Réseau (PWA)** : Stockage local des commandes et synchronisation en arrière-plan (Background Sync) indispensable pour les zones à faible couverture.
- **Sécurité Anti-Fraude** : Identification obligatoire du client pour corréler chaque vente cash à une personne physique.

### Integration Requirements
- **Stock Hybride** : Règles de conversion complexes entre unités de gros (Casiers de 12/24) et unités de détail (Bouteille, cl).
- **Badge-Scan (RFID/QR)** : Intégration matérielle ou logicielle pour l'authentification rapide des serveurs.

### Risk Mitigations
- **Risque de Coulage** : Alerte automatique en cas de divergence répétée entre le stock théorique et le stock physique inventorié.
- **Perte de Données** : Sauvage locale persistante (IndexedDB) pour éviter toute perte de commande lors d'une déconnexion prolongée.

## SaaS B2B & Web App (PWA) Requirements

### Subscription & Multi-Tenancy
- **Pricing Model**:
    - Standard: **3$ / table / mois**.
    - Annual: **2$ / table / mois** (Paiement intégral à l'année).
- **Tenant Isolation**: Chaque établissement (Bar ou Évènement) dispose d'une base de données isolée et de sa propre configuration de menu/stock.

### Role-Based Access Control (RBAC)
- **Patron (Admin)** : Accès total (Gestion des prix, gestion du stock, suppression de ventes, rapports).
- **Serveur / Vigie (User)** : 
    - *Autorisé* : Prise de commande, encaissement cash.
    - *Interdit* : **Zéro suppression** de vente, **zéro modification** de prix, **zéro modification** de stock.
- **Protocole (Events)** : Droits limités à la gestion opérationnelle du stock "Mode Invitation", sans accès aux paramètres financiers du Patron.

### PWA & Real-Time Logistics
- **Offline Feedback** : En cas de perte réseau, l'interface client doit afficher visuellement le statut **"En attente de synchronisation"** pour chaque commande.
- **Low Latency Stock Update** : Mise à jour du menu client en "temps réel" (< 500ms).
- **Design Language** : Style **Minimaliste Apple** (Espaces blancs généreux, typographie San Francisco ou équivalent, icônes premium, micro-animations discrètes).

### Boucle de Commande (Recursive Ordering)
- **Logique** : Le client peut activer un mode "Abonnement de table" pour une durée déterminée.
- **Exemple** : "Servir 3 Turbos et 2 Beauforts toutes les 90 minutes".
- **Validation** : Le système génère une pré-commande automatique dans la file d'attente du serveur à l'intervalle choisi.

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **IA de Croissance Stratégique** : Intégration d'un agent IA qui ne se contente pas de compter les bouteilles, mais suggère au patron : "Vos ventes de Moet augmentent le samedi soir, vous devriez agrandir votre zone VIP". C'est du **SaaS B2B avec Agent Intelligent**.
3. **Logistique Hybride "Kin-Stock"** : Modélisation unique de la conversion Casier (12/24) ↔ Bouteille ↔ cl (centilitre) en temps réel, adaptée aux habitudes de consommation locales.
4. **Le Mode "Invitation" (Protocoles)** : Détournement d'un logiciel de vente pour en faire un outil de logistique pure pour évènements (zéro facture), ce qui rationalise le travail du personnel de protocole.

### Market Context & Competitive Landscape
- **Concurrence** : Les solutions locales (Ebutelo, etc.) se concentrent sur la facturation. Les solutions internationales (Square, Lightspeed) ne gèrent pas bien les spécificités des casiers ou les coupures réseau fréquentes en RDC.
- **Notre avantage** : BarPilote est "Offline-First" et "Security-First" par design.

### Validation Approach
- **Phase Alpha** : Test des flux de commande dans 1 bar pilote pour vérifier la fluidité de l'identification minimale.
- **Audit Stock** : Comparaison hebdomadaire entre l'IA et les inventaires manuels pour affiner les algorithmes de prédiction.

## Non-Functional Requirements

### Performance
- **Réactivité Stock** : Le recalcul des casiers/bouteilles après une vente s'affiche en moins de **100ms**.
- **Vitesse de Commande** : Envoi et réception de commande (< 500ms) pour garantir la fluidité en terrasse.

### Security
- **Audit Trail & Intégrité** : Chaque sortie de stock est liée de manière indélébile à un `Client_ID` et un `Serveur_ID`.
- **RBAC (Role-Based Access Control)** : Seul le **Patron** (Admin) peut supprimer des ventes ou modifier les prix/stocks.

### Reliability & Availability
- **Offline-First (24h Autonomous)** : Le système doit fonctionner 24h sans internet via PWA (IndexedDB) pour garantir la continuité du service à Kinshasa.
- **Auto-Sync** : Synchronisation transparente vers le cloud du Patron dès le retour d'une connexion internet.

### Scalability
- **Elasticité Multi-Bar** : Architecture supportant **100 établissements simultanés** sur une instance serveur standard sans dégradation de performance.

## Functional & Technical Requirements

### 1. Moteur de Calcul de Stock (Casiers & Bouteilles)
- **Logique de Vente** : Lorsqu'une bouteille est vendue (ex: Primus), le système décrémente instantanément le stock de bouteilles.
- **Recalcul Dynamique** : Le système doit afficher en permanence :
    - Nombre de casiers **complets** restants (ex: 2 casiers de 12).
    - Nombre de bouteilles **isolées** (incomplètes) restantes (ex: 3 bouteilles).
- **Gestion des Vides** : Les bouteilles vides ne sont **pas suivies** dans le MVP. Le focus est sur le contenu (le plein).

### 2. Identification Client Simplifiée
- **Champs Obligatoires** : Nom, Prénom, Numéro de téléphone.
- **Vérification** : **Zéro vérification** (pas de SMS OTP). Le but est la rapidité et la traçabilité nominale simplifiée.

### 3. Files d'Attente Temps Réel & Affectation
- **Interface Serveur** : Liste chronologique des commandes entrantes limitée aux **tables assignées** (ex: Tshala ne voit que les commandes des tables 1, 2 et 3 si elles lui ont été affectées).
- **Mise à Jour** : Notification immédiate (vibration/son) sur l'appareil du serveur à chaque nouvelle commande.

### 4. Logistique Évènementielle (Mode Events)
- **Allocation du Personnel** : L'organisateur peut définir des zones ou des groupes de tables et les assigner à un ou plusieurs serveurs/protocoles.
- **Visibilité Organisateur** : Vue d'ensemble montrant quel serveur est responsable de quelle zone et le stock consommé par zone.
