# Rapport de Recherche Technique : Spiritueux & Vente au cl RDC 🥃🍷🍾

**Sujet** : Étude des prix de gros spiritueux et modélisation de la vente fractionnée (verre/cl).
**Région** : Kinshasa, RDC
**Date** : 11 Mars 2026
**Chercheuse** : Mary

---

## 🥃 Whiskies & Cognacs (Prix indicatifs Grossistes Kinshasa)
Les prix sont en Francs Congolais (FC) ou Dollars ($) selon les arrivages.

| Produit | Format | Prix d'Achat Estimé | Source / Note |
| :--- | :--- | :--- | :--- |
| **Hennessy VS** | 70 cl | 215 000 FC | Kinshasa Drinks |
| **Chivas Regal 12Y** | 70 cl | 77 500 FC | So Good RDC |
| **Chivas Regal 18Y** | 70 cl | 200 500 FC | |
| **J.W. Double Black** | 70 cl | 57 500 FC | |
| **J.W. Blue Label** | 75 cl | ~250 $ | KWETU RDC |
| **Jack Daniel's** | 70 cl | ~45 $ | |

## 🍾 Champagnes & Vins
| Produit | Format | Prix d'Achat Estimé | Source / Note |
| :--- | :--- | :--- | :--- |
| **Veuve Clicquot Rich** | 75 cl | 258 000 FC | Kinshasa Drinks |
| **Moët & Chandon** | 75 cl | ~220 000 FC | |
| **Vins Bordeaux/Castel**| 75 cl | 15$ - 45$ | Selon cru (La Clé des Châteaux) |

---

## ⚙️ Modélisation Technique : Vente au "cl"
Pour permettre au propriétaire de vendre au verre ou à la bouteille avec un stock unifié.

### 1. Structure de l'Article (Base de données)
```json
{
  "boisson": "Hennessy VS",
  "contenance_totale": 70, // cl
  "stock_bouteilles_scellees": 12,
  "volume_bouteille_ouverte": 42.5, // cl restant
  "unites_vente": [
    {"label": "Bouteille Entière", "volume": 70, "prix": "Propriétaire"},
    {"label": "Verre Standard", "volume": 4, "prix": "Propriétaire"},
    {"label": "Double Dose", "volume": 8, "prix": "Propriétaire"}
  ]
}
```

### 2. Algorithme de décrue automatique
- Chaque fois qu'une dose de **4 cl** est vendue :
    1. Si `volume_bouteille_ouverte` >= 4 -> Soustraire 4.
    2. Si `volume_bouteille_ouverte` < 4 -> "Vider la fin" + Entamer une nouvelle bouteille (`stock_bouteilles_scellees` -1) + Reset `volume_bouteille_ouverte` à (Contenance - Manquant).

### 3. Contrôle du Propriétaire
Le propriétaire a un curseur libre pour :
- Déterminer le prix de la bouteille (ex: 150$).
- Déterminer le prix du cl (ex: 2.5$ / cl).
- Déterminer la taille du verre (cl).

---
**Mary's Advice** : "La vente au 'cl' est la source de profit la plus élevée mais aussi la plus risquée (coulage). Le système BarPilote doit alerter dès qu'une bouteille ouverte 'traîne' trop longtemps ou que le ratio ventes/stock théorique diverge." 🕵️‍♀️✨🥃📊
