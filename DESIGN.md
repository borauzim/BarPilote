---
name: BarPilote
description: Un poste de dispatch opérationnel pour piloter, servir et commander à table.
colors:
  command-forest: "#0f172a"
  command-forest-hover: "#1e293b"
  workspace-canvas: "#f8fafc"
  customer-canvas: "#f5f6f3"
  surface: "#ffffff"
  surface-subtle: "#f8fafc"
  surface-muted: "#f1f5f9"
  ink: "#0f172a"
  muted-ink: "#64748b"
  muted-ink-customer: "#5d6760"
  action-orange: "#ea580c"
  signal-orange: "#f97316"
  signal-orange-soft: "#fff7ed"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.35rem)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "0.035em"
rounded:
  compact: "8px"
  control: "10px"
  surface: "14px"
  sheet: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-orange}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  button-command:
    backgroundColor: "{colors.command-forest}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
---

# Design System: BarPilote

## Overview

**Creative North Star: "Le poste de dispatch"**

BarPilote présente l’exploitation du bar comme un centre de contrôle continu : le propriétaire supervise, le serveur exécute et le client commande dans une même chaîne lisible et traçable. Le contrat de direction présent dans les templates racine impose un monde mat et opérationnel — vert forêt, surfaces claires, lignes fines et coins mesurés — et refuse le tableau de bord SaaS générique composé de cartes uniformes.

Le système est commun aux quatre surfaces, mais sa densité suit le rôle. L’espace Propriétaire est le plus dense : largeur généreuse, tableaux compacts et comparaison transversale. L’espace Serveur reprend le rail avec une composition plus directe, une base de contenu légèrement renforcée et des actions tactiles systématiques. Le parcours Client se concentre sur une colonne mobile, un catalogue en deux ou trois colonnes et une barre de commande persistante. L’Authentification est la surface la plus calme : formulaire centré et étroit, ou choix de rôle en deux panneaux sur écran moyen.

**Key Characteristics:**

- Rail de commande vert forêt sur desktop et dock forêt au bas de l’écran sur mobile.
- Journal opérationnel placé avant les blocs analytiques quand des commandes en direct sont présentes.
- Orange foncé accessible pour les actions remplies; orange plus vif réservé au signal, au focus et à la sélection.
- Inter unique, titres très gras et chiffres tabulaires dans les espaces opérationnels.
- Contrôles prioritaires d’au moins 44px, focus clavier visible et réduction du mouvement respectée.

### Verification boundary

Ce document décrit le code livré : les quatre feuilles de rôle, leurs templates Django et le contrat de direction embarqué. Cette passe n’inclut pas de captures authentifiées ni de relevé des styles calculés dans un navigateur. Les classes Tailwind chargées par CDN et les blocs de style propres à certains templates peuvent donc créer des exceptions locales; une règle de rôle plus tardive déclarée prioritaire dans la cascade prévaut sur la classe utilitaire visible dans le markup.

## Colors

La palette commune associe un vert forêt structurel, des canevas gris-ivoire très clairs et deux oranges distincts par fonction.

### Primary

- **Vert forêt de commande:** structure les rails desktop, les docks mobiles, les en-têtes de tableaux et les actions de commande sombres.
- **Orange d’action accessible:** remplit les actions principales avec du texte blanc et atteint un contraste de 5.29:1 sur blanc. Les corrections finales des quatre rôles forcent cette teinte sur les boutons orange remplis et remplacent les anciens gradients.

### Secondary

- **Orange signal:** marque les bordures sélectionnées, le focus des champs, la ligne active du rail et les accents qui demandent l’attention. Sa version douce sert de fond d’accompagnement, jamais de substitut au contraste d’une action remplie.

### Neutral

- **Canevas de travail:** fond clair des espaces Propriétaire, Serveur et Authentification.
- **Canevas client:** variante très proche, propre au parcours de commande mobile.
- **Surface blanche:** cartes, champs, feuilles et en-têtes translucides.
- **Surfaces subtile et atténuée:** regroupements, lignes en survol et contrôles secondaires.
- **Encre forestière:** texte principal et chiffres importants.
- **Encres atténuées:** texte secondaire; la variante Client/Authentification est légèrement plus claire que celle des espaces opérationnels.

### Named Rules

**The Filled Action Rule.** Utiliser l’orange d’action accessible pour tout bouton orange plein avec texte blanc; ne pas réintroduire le gradient orange historique ni employer l’orange signal plus clair comme remplissage final.

**The Signal, Not Decoration Rule.** L’orange vif indique un focus, une sélection ou un appel d’attention; il ne remplit pas de grandes zones décoratives.

**The Semantic State Rule.** Les couleurs d’erreur, d’attente, d’information et de réussite conservent leur sens métier dans les templates. Toujours accompagner leur couleur d’un texte, une icône ou un libellé.

## Typography

**Display Font:** Inter (avec repli sans-serif)  
**Body Font:** Inter (avec repli sans-serif)  
**Label Font:** Inter (avec repli sans-serif)

**Character:** Une seule famille sans serif porte une voix compacte, robuste et immédiatement lisible. La personnalité vient des graisses élevées, des titres serrés et des micro-libellés espacés, non d'une paire décorative.

### Hierarchy

- **Display** (900, fluide, 1.12): montants, messages de mission et titres majeurs; les très grands utilitaires sont ramenés à une échelle contrôlée par la feuille de rôle.
- **Headline** (800, 1.5rem, 1.15): titres de page et regroupements opérationnels.
- **Title** (800, 1.125rem, 1.15): cartes, panneaux et objets métier.
- **Body** (400, 1rem, 1.55): contenu courant et explications. Le contenu principal Serveur descend à une base plus compacte de 0.925rem tout en conservant des contrôles plus grands.
- **Label** (700, 0.72rem, 0.035em): navigation, métadonnées, statuts et commandes compactes; certains sourcils utilisent les capitales avec un espacement plus marqué.

Les nombres opérationnels utilisent des chiffres tabulaires dans les espaces Propriétaire, Serveur et Client afin de stabiliser montants, quantités et compteurs pendant les mises à jour.

### Named Rules

**The Operational Voice Rule.** Utiliser les fortes graisses pour orienter et décider, puis revenir à une graisse régulière pour expliquer; ne pas transformer chaque ligne en cri visuel.

## Layout

À partir de 1024px, les espaces Propriétaire et Serveur installent un rail fixe de 15.5rem à gauche. Le contenu se décale de la même largeur, reste fluide jusqu’à 1600px et reçoit des marges internes adaptatives de 1.5 à 3rem. L’espace Propriétaire exploite cette largeur avec des tableaux à 0.82rem, des colonnes de synthèse et des données nombreuses. L’espace Serveur conserve la même charpente, mais privilégie les commandes courantes, une base de contenu à 0.925rem et des contrôles de 44px.

**The Mission-First Journal Rule.** Sur les dashboards qui contiennent le flux de commandes en direct, la cascade transforme le contenu en colonne, place la grille opérationnelle avant le hero de revenus, puis place le « Journal de Bord » avant la grille de KPI dans la colonne principale. Les avis contractuels ou d’abonnement présents dans le DOM peuvent rester au-dessus; ne pas reconstruire le hero analytique comme première mission lorsque le journal existe.

Le parcours Client reste centré dans une colonne au plus 48rem. Son catalogue affiche deux produits par rangée, trois à partir de 640px, puis une seule colonne sous 360px. L’en-tête, les filtres et la barre de commande peuvent rester collants; le dock de quatre destinations reste fixé en bas. L’Authentification centre le formulaire principal dans 28rem et passe le choix de rôle d’une à deux colonnes à partir de 768px.

Sous 1024px, le rail Propriétaire/Serveur redevient un en-tête clair et la navigation principale descend dans un dock sombre. Sous 768px, les marges principales se resserrent à 12px, les grands espacements se compactent, les cartes de commande empilent leurs actions et le contenu laisse la place au dock ainsi qu’aux safe areas. Sous 640px, les tableaux conservent une largeur minimale de 42rem dans une zone à défilement horizontal et le centre de notifications devient un panneau presque plein écran.

Le rythme commun repose sur 4, 8, 12, 16, 24 et 32px. Une cible de 44px est le plancher des boutons, icônes, quantités, filtres et champs prioritaires; les destinations de dock atteignent 48 à 54px.

## Elevation & Depth

Le système est plat par défaut. Les feuilles de rôle annulent les ombres utilitaires sur les cartes courantes et construisent la hiérarchie avec les tons, les bordures fines et la position. Les ombres restent réservées aux rails, docks, panneaux de notifications, feuilles basses, alertes persistantes et commandes rapides flottantes. Les en-têtes collants utilisent un blanc presque opaque et un flou léger sans transformer l’ensemble en interface vitrée.

### Shadow Vocabulary

- **Header ambient** (0 8px 24px rgba(19, 37, 29, .06)): sépare l’en-tête clair lorsque le rail desktop a disparu.
- **Floating panel** (0 16px 40px rgba(19, 37, 29, .12)): notifications, modales et surfaces détachées du flux.
- **Command rail** (16px 0 48px rgba(19, 37, 29, .10)): séparation latérale du rail desktop.
- **Role dock** (0 -16px 40px rgba(19, 37, 29, .18)): séparation du dock Propriétaire/Serveur.
- **Customer dock** (0 -14px 32px rgba(19, 37, 29, .18)): séparation du dock Client.
- **Bottom sheet** (0 -18px 48px rgba(19, 37, 29, .18)): feuilles d’identité et de libération de table.

**The Flat-by-Default Rule.** Une surface au repos se définit d’abord par son ton et sa bordure; l’ombre indique la persistance, la superposition ou une action flottante.

## Shapes

Les contrôles utilisent des coins de 10px et les surfaces courantes des coins de 14px. Les petits contrôles internes et filtres de notifications peuvent descendre à 8px. Les feuilles basses Client utilisent 16px sur leurs coins supérieurs. Les formes pilules restent permises pour les bascules, badges, filtres intrinsèquement compacts et actions flottantes étiquetées; les avatars et boutons d’icône peuvent être circulaires.

Les règles de rôle normalisent les anciens rayons utilitaires de 24 à 40px vers ces valeurs mesurées. Les images de contenu reçoivent un filet intérieur très discret; les logos en sont exemptés.

**The Measured Corners Rule.** Employer 10px pour les contrôles et 14px pour les surfaces ordinaires; réserver 8px aux petits éléments internes, 16px aux feuilles basses et la pilule aux formes dont la fonction l’exige.

## Components

### Buttons

- **Shape:** rectangle compact à coins mesurés, avec une hauteur minimale de 44px pour toute action prioritaire.
- **Primary:** orange d’action accessible sur texte blanc, en aplat et graisse forte. Les classes de gradient ou d’orange utilitaire sont normalisées vers la même teinte par la feuille de rôle.
- **Hover / Focus / Active:** le focus clavier emploie un contour orange translucide de 3px décalé de 3px; l’appui réduit brièvement l’échelle à 0.96. Ne pas dépendre d’un changement de teinte au survol, car la correction finale maintient déjà l’aplat foncé sur plusieurs boutons.
- **Command / Secondary:** vert forêt ou encre sombre pour les actions structurelles; surface blanche bordée pour les actions secondaires.

### Chips

- **Style:** catégorie inactive sur surface blanche avec bordure fine; catégorie active sur vert forêt avec texte blanc.
- **State:** la sélection modifie simultanément le fond et le contraste du texte. Les chips et sélecteurs Client respectent la cible de 44px.

### Cards / Containers

- **Corner Style:** coins de surface mesurés (14px), avec 16px sur les feuilles basses.
- **Background:** blanc sur canevas clair; tons subtils pour les regroupements secondaires.
- **Shadow Strategy:** aucune ombre sur une carte ordinaire au repos; les cartes interactives indiquent surtout leur état par la bordure ou le ton.
- **Border:** ligne d’encre forestière à faible opacité.
- **Internal Padding:** 12 à 24px selon le rôle; la densité Propriétaire peut descendre plus bas dans les tableaux.

### Inputs / Fields

- **Style:** surface blanche, bordure forestière renforcée, coins de 10px et hauteur minimale de 44px.
- **Focus:** bordure orange signal et halo orange translucide de 3px.
- **Placeholder / Disabled:** placeholder lisible; les états désactivés diminuent le contraste sans effacer la géométrie ou le libellé.

### Navigation

Le rail Propriétaire/Serveur est vertical et forêt, avec texte blanc atténué au repos. L’état actif utilise un panneau forêt plus clair et un filet orange intérieur à gauche. Sous 1024px, le rail devient un en-tête clair et un dock forêt fixé en bas. Le Client possède son propre dock forêt de quatre destinations avec des cibles de 54px. L’Authentification n’affiche ni rail ni dock.

### Operational Journal

Le « Journal de Bord » est le composant signature des dashboards Propriétaire et Serveur. Il présente les commandes en temps réel avant les indicateurs analytiques, avec statut, table, montant et actions dans un flux vertical. Le Serveur limite le journal à ses commandes et lui accorde un défilement interne; le Propriétaire conserve une vue transversale et les contrôles de réception.

### Operational Tables

Les tableaux Propriétaire/Serveur utilisent un en-tête forêt, des libellés blancs compacts et espacés, puis des lignes blanches séparées par un filet. Leur densité est volontairement supérieure à celle des cartes Client; sur petit écran ils défilent horizontalement au lieu d’écraser les colonnes.

### Global Order Alert

L’alerte globale est une surface blanche persistante et élevée avec bordure orange discrète. Son importance vient de sa position, de son animation brève et de sa profondeur; elle ne devient pas un grand aplat orange. Ses actions sont normalisées à 44px.

## Do's and Don'ts

### Do:

- **Do** faire du Journal de Bord la première lecture opérationnelle des dashboards qui contiennent des commandes en direct.
- **Do** conserver la densité de décision du Propriétaire, la tactilité d’exécution du Serveur, la simplicité de commande du Client et le calme de l’Authentification.
- **Do** utiliser le rail forêt à partir de 1024px et les docks forêt prévus sur les petits écrans.
- **Do** utiliser l’orange d’action accessible pour les boutons pleins à texte blanc et l’orange signal pour le focus ou la sélection.
- **Do** maintenir des cibles d’au moins 44px, un focus clavier visible, des états doublés par texte ou icône et le support de la préférence CSS prefers-reduced-motion.
- **Do** vérifier les pages rendues dans leur vrai état authentifié avant de généraliser une exception locale de template.

### Don't:

- **Don't** revenir à un dashboard SaaS générique composé de cartes uniformes et interchangeables.
- **Don't** replacer le hero de revenus ou la grille de KPI avant le journal opérationnel quand le flux en direct existe.
- **Don't** utiliser l’orange signal plus clair comme remplissage d’une action principale avec texte blanc, ni réintroduire les anciens gradients.
- **Don't** appliquer la densité Propriétaire au parcours Client ou réduire les actions Serveur sous le plancher tactile.
- **Don't** accumuler ombres lourdes, verre, gradients et très grands rayons; la matière reste mate, bordée et mesurée.
- **Don't** déduire une règle globale d’une seule classe Tailwind sans tenir compte de la cascade de la feuille de rôle.


## Dashboard propriétaire — console SaaS premium

Le dashboard propriétaire adopte une composition de console opérationnelle à quatre colonnes. Le premier niveau aligne le revenu du jour, l occupation et les commandes actives; le journal occupe ensuite les trois quarts de la largeur et les alertes stock le quart restant. Le canevas est gris froid, les surfaces sont blanches avec une bordure ardoise subtile et une ombre ambiante minimale. La barre de navigation supérieure reste anthracite et l orange devient l unique accent d action, de sélection et de progression. Les libellés utilisent la casse phrase, Inter et une densité compacte. La navigation principale reste horizontale et fixe. Sur mobile, les KPI passent en deux colonnes, les régions métier s empilent et l action de création devient une commande carrée dans l en-tête.
