# Rapport de Recherche Technique : Architecture & Sécurité BarPilote 🛡️⚙️

**Sujet** : Validation technique des concepts innovants déterrés en brainstorming.
**Date** : 11 Mars 2026
**Chercheuse** : Mary (Analyste Senior)

---

## 🔐 1. QR Codes Dynamiques & Sceau de Confiance
Pour contrer l'usurpation d'identité et les interfaces "miroirs" :

### Recommandations de Sécurité :
- **URLs Éphémères** : Utilisation d'IDs de session courts (ex: Hash unique par table + Timestamp).
- **Le Sceau de Confiance Dynamique** : 
    - *Technique* : Un composant UI qui récupère un "Secret Visuel" (couleur + icône) via WebSocket.
    - *Rotation* : Changement automatique toutes les X minutes synchronisé sur tous les terminaux du bar (Serveurs & Clients).
- **HTTPS & Branding** : Indispensable pour éviter les détournements par DNS ou injection locale.

## ⚡ 2. Synchronisation Temps Réel (Stock & Dispatching)
Pour que les serveurs et clients voient la même réalité au même moment :

### Choix Technologiques :
- **Socket.io (Node.js)** : Idéal pour BarPilote car il gère les reconnexions automatiques et les "salles" (ex: une salle par bar ou par table).
- **Pusher (Hosted)** : Recommandé pour un MVP rapide (Moins de maintenance serveur, haute fiabilité).
- **Interface "Vigie"** : Les serveurs reçoivent les commandes via des événements Push, bloquant immédiatement leur statut en "Occupé".

## 📦 3. Gestion Hybride du Stock
Structure de données optimisée pour la conversion Casier -> Bouteille.

### Modèle de Données Suggéré :
```json
{
  "item": "Beer X",
  "purchase_unit": "Case (20 bottles)",
  "sale_unit": "Bottle",
  "conversion_ratio": 20,
  "stock_virtual": 145, // En bouteilles
  "stock_physical": {
    "full_cases": 7,
    "loose_bottles": 5
  }
}
```
*Le système déduira 1 du "stock_virtual" à chaque vente QR et préviendra quand "loose_bottles" tombe à 0 pour ouvrir un nouveau casier.*

## 📶 4. Résilience Hors-ligne (Offline-First)
Dans un bar, le Wi-Fi peut être capricieux.

### Stratégie de Résilience :
- **PWA (Progressive Web App)** : Utilisation de Service Workers pour que l'interface du serveur reste fluide même sans réseau.
- **Local Storage / IndexedDB** : Les ventes sont stockées localement et synchronisées avec le serveur central dès que la connexion revient.
- **Validation Bi-Phase** : Le bouton "Paiement Reçu" enregistre l'heure de l'action locale pour une traçabilité parfaite même en cas de retard de synchro.

---
### 🏁 Conclusion de Mary 
Toutes les pièces du puzzle technique sont validées. Nous avons les outils pour construire une forteresse numérique capable de briller sur le terrain !

**Mary's Next Move** : Prête pour la phase de **Planification (PRD)** ! 🕵️‍♀️✨💎⚙️
