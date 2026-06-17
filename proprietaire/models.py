from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal
import uuid

from django.conf import settings
from django.urls import reverse

class Bar(models.Model):
    """
    Modèle représentant un établissement (Bar, Lounge, Boîte de nuit).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nom = models.CharField(max_length=255, verbose_name="Nom du Bar")
    adresse = models.TextField(blank=True, null=True, verbose_name="Adresse complète")
    google_place_id = models.CharField(max_length=255, blank=True, null=True)
    latitude = models.DecimalField(max_digits=22, decimal_places=16, blank=True, null=True)
    longitude = models.DecimalField(max_digits=22, decimal_places=16, blank=True, null=True)
    BAR_TYPES = [
        ('BAR', 'Bar'),
        ('LOUNGE', 'Lounge Bar'),
        ('CLUB', 'Boîte de nuit'),
        ('BISTRO', 'Bistro / Restaurant'),
        ('TERRASSE', 'Terrasse'),
        ('PUB', 'Pub'),
        ('EVENT', 'Événement Éphémère'),
    ]
    type_etablissement = models.CharField(
        max_length=20, 
        choices=BAR_TYPES, 
        default='BAR', 
        verbose_name="Type d'établissement"
    )
    # Code unique pour le QR — les serveurs scannent ce code pour rejoindre le bar
    code_invitation = models.UUIDField(
        default=uuid.uuid4, 
        unique=True, 
        editable=False, 
        verbose_name="Code d'invitation QR"
    )
    logo = models.ImageField(upload_to='bar_logos/', blank=True, null=True, verbose_name="Logo de l'établissement")
    taux_change_usd_to_cdf = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('2800.00'), verbose_name="Taux de change (1$ en FC)")
    seuil_dette_eligible = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('100000.00'), verbose_name="Seuil d'éligibilité pour dette (FC)")
    prix_mensuel_par_table_usd = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('2.50'), verbose_name="Prix mensuel par table (USD)")
    
    # Abonnement & Période d'essai
    abonnement_expire_le = models.DateTimeField(null=True, blank=True, verbose_name="Date d'expiration de l'abonnement")
    date_creation = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # L'expiration d'abonnement est gérée explicitement au moment de la création.
        super().save(*args, **kwargs)

    @property
    def jours_restants(self):
        from django.utils import timezone
        if not self.abonnement_expire_le:
            return 0
        delta = self.abonnement_expire_le - timezone.now()
        return max(0, delta.days)

    @property
    def tables_facturables_count(self):
        """Compte les tables actives qui sont réellement facturées."""
        return self.tables.filter(est_active=True).count()

    @property
    def prix_table_mensuel_usd(self):
        return self.prix_mensuel_par_table_usd or Decimal('0.00')

    @property
    def prix_mensuel_estime(self):
        """Calcule le total mensuel selon le nombre de tables actives de cet établissement."""
        return self.tables_facturables_count * self.prix_table_mensuel_usd

    @property
    def prix_annuel_estime(self):
        """Estimation annuelle avec l'offre standard de -10 %."""
        return self.prix_mensuel_estime * Decimal('12') * Decimal('0.90')

    def __str__(self):
        return self.nom

def upload_pilot_photo(instance, filename):
    """Sépare les dossiers de stockage par rôle"""
    role_str = instance.role.lower() if instance.role else 'unknown'
    return f'profils/{role_str}/{filename}'

class PilotProfile(models.Model):
    """
    Modèle étendant l'utilisateur Django par défaut pour y ajouter 
    les spécificités du "Pilote" (Propriétaire/Admin).
    """
    SEXE_CHOICES = [
        ('M', 'Masculin'),
        ('F', 'Féminin'),
    ]

    ROLE_CHOICES = [
        ('PROPRIETAIRE', "Propriétaire d'un établissement"),
        ('SERVEUR', 'Serveur ou Protocole'),
        ('EVENEMENT', 'Organisateur d’un événement'),
    ]

    # Le lien OneToOne vers l'utilisateur classique (qui gère l'email, password)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='pilot_profile')
    
    # Rôle exécutif choisi lors de l'onboarding
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, blank=True, null=True, verbose_name="Rôle Exécutif")
    
    # Bar actif utilisé par les vues et l'interface courante
    bar = models.ForeignKey(Bar, on_delete=models.SET_NULL, null=True, blank=True, related_name='proprietaires')
    # Liste de tous les établissements possédés par ce profil
    owned_bars = models.ManyToManyField(Bar, blank=True, related_name='owners', verbose_name='Etablissements possedes')
    # Date à laquelle cet utilisateur a consommé son essai gratuit BarPilote
    trial_consumed_at = models.DateTimeField(null=True, blank=True, verbose_name='Essai gratuit consommé le')
    
    # Champs d'identité (On sépare Nom, Postnom, Prénom pour plus de précision)
    nom = models.CharField(max_length=150, blank=True, verbose_name="Nom")
    postnom = models.CharField(max_length=150, blank=True, verbose_name="Postnom")
    prenom = models.CharField(max_length=150, blank=True, verbose_name="Prénom")
    
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES, blank=True, verbose_name="Sexe")
    telephone = models.CharField(max_length=20, blank=True, verbose_name="Numéro de téléphone")
    photo_profil = models.ImageField(upload_to=upload_pilot_photo, blank=True, null=True, verbose_name="Photo de Profil")
    preferred_currency = models.CharField(max_length=3, choices=[('USD', 'USD ($)'), ('CDF', 'CDF (FC)')], default='USD')
    last_seen = models.DateTimeField(null=True, blank=True, verbose_name="Dernière activité")
    
    @property
    def is_online(self):
        if not self.last_seen:
            return False
        from django.utils import timezone
        from datetime import timedelta
        return self.last_seen >= timezone.now() - timedelta(minutes=5)

    @property
    def owned_bars_count(self):
        return self.owned_bars.count()

    def owns_bar(self, bar):
        if not bar:
            return False
        return self.owned_bars.filter(id=bar.id).exists()

    @property
    def trial_is_available(self):
        return self.trial_consumed_at is None

    def mark_trial_consumed(self):
        from django.utils import timezone
        self.trial_consumed_at = timezone.now()
        self.save(update_fields=['trial_consumed_at'])

    def __str__(self):
        return f"{self.get_role_display()}: {self.prenom} {self.nom} ({self.postnom})"

class Table(models.Model):
    """
    Modèle représentant une table physique dans le Bar.
    Liée à la génération du QR Code interactif.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='tables')
    nom = models.CharField(max_length=50, verbose_name="Nom de la Table (ex: Table 12, VIP Lounge)")
    
    # Le QR code généré sera stocké ici ou construit dynamiquement
    code_qr_image = models.ImageField(upload_to='qr_codes/', blank=True, null=True, verbose_name="Flyer QR Code")
    est_active = models.BooleanField(default=True, verbose_name="Table active")
    date_creation = models.DateTimeField(auto_now_add=True)

    @property
    def client_menu_url(self):
        """Lien public à encoder dans le QR code de la table."""
        path = reverse('client_menu', args=[self.id])
        site_url = getattr(settings, 'SITE_URL', '').rstrip()
        return f"{site_url}{path}" if site_url else path

    class Meta:
        # On ne peut pas avoir deux "Table 1" dans le même bar
        unique_together = ('bar', 'nom')

class Perte(models.Model):
    """
    Modèle pour enregistrer les pertes de stock (casse, péremption, vol, etc.)
    """
    RAISON_CHOICES = [
        ('CASSE', 'Casse / Dommage'),
        ('PEREMPTION', 'Péremption'),
        ('VOL', 'Vol / Disparition'),
        ('OFFERT', 'Offert / Promo'),
        ('ERREUR', 'Erreur Inventaire'),
    ]
    
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='pertes')
    item = models.ForeignKey('StockItem', on_delete=models.CASCADE, related_name='details_pertes')
    reported_by = models.ForeignKey(
        'PilotProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reported_losses',
        verbose_name="Signalée par",
    )
    quantite = models.PositiveIntegerField(default=1)
    raison = models.CharField(max_length=20, choices=RAISON_CHOICES, default='CASSE')
    commentaire = models.TextField(blank=True, null=True)
    date_perte = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Perte: {self.quantite} x {self.item.produit.nom} ({self.raison})"

class Category(models.Model):
    """
    Catégories de produits (Bières, Spiritueux, Softs, etc.)
    """
    nom = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, blank=True, null=True, help_text="Nom de l'icône Material Symbol")

    def __str__(self):
        return self.nom

    class Meta:
        verbose_name_plural = "Categories"

class MasterProduct(models.Model):
    """
    Catalogue global de produits proposé par BarPilote (Référentiel).
    """
    FORMAT_CHOICES = [
        ('PETIT', 'Petit Format (ex: 30cl, 33cl)'),
        ('GROS', 'Gros Format (ex: 50cl, 65cl, 72cl)'),
    ]

    nom = models.CharField(max_length=255)
    categorie = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='produits')
    volume = models.CharField(max_length=50, blank=True, null=True, help_text="ex: 33cl, 75cl, 1L")
    volume_cl = models.IntegerField(default=0, help_text="Volume total en cl (ex: 75, 100)")
    format_casier = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='PETIT', verbose_name="Format du Casier")
    photo = models.ImageField(upload_to='master_products/', blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.nom} ({self.volume})"

class StockItem(models.Model):
    """
    L'inventaire spécifique d'un Bar (Mapping entre Bar et MasterProduct).
    Gère les prix et les alertes.
    """
    CURRENCY_CHOICES = [
        ('USD', '$ (Dollar)'),
        ('CDF', 'FC (Franc Congolais)'),
    ]
    
    STRATEGY_CHOICES = [
        ('UNITE', 'À l\'unité (Bouteille)'),
        ('CASIER', 'Par casier'),
    ]

    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='inventaire')
    produit = models.ForeignKey(MasterProduct, on_delete=models.CASCADE)
    
    # Stratégie de gestion
    strategie_gestion = models.CharField(max_length=10, choices=STRATEGY_CHOICES, default='UNITE')
    quantite_actuelle = models.DecimalField(max_digits=12, decimal_places=3, default=0, verbose_name="Bouteilles en stock")
    seuil_alerte = models.IntegerField(default=12, verbose_name="Alerte stock faible")
    
    # --- VENTE AU VERRE (Whisky, Vin, etc.) ---
    vente_au_verre = models.BooleanField(default=False, verbose_name="Activer la vente au verre")
    volume_verre_cl = models.IntegerField(default=5, help_text="Taille standard du verre en cl (ex: 5, 12, 15)")
    prix_vente_verre = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reduction_bouteille_entiere = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Réduction en % si achat bouteille complète")
    # ------------------------------------------

    # Prix & Monnaie
    devise = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    
    # Champs pour stratégie CASIER
    prix_achat_casier = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Prix d'un casier complet")
    bouteilles_par_casier = models.IntegerField(default=24, blank=True, null=True, help_text="Nombre de bouteilles dans un casier")
    
    # Champs pour stratégie UNITE (ou calculé automatiquement)
    prix_achat_unitaire = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Prix de revient par bouteille")
    prix_vente_unitaire = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        unique_together = ('bar', 'produit')

    def __str__(self):
        return f"{self.produit.nom} @ {self.bar.nom}"

    @property
    def can_sell_bottle(self):
        return self.prix_vente_unitaire and self.prix_vente_unitaire > 0

    @property
    def can_sell_glass(self):
        if not self.prix_vente_verre or self.prix_vente_verre <= 0:
            return False
        if self.vente_au_verre:
            return True

        category_name = (self.produit.categorie.nom or '').lower() if self.produit and self.produit.categorie else ''
        product_name = (self.produit.nom or '').lower() if self.produit else ''
        searchable_name = f"{category_name} {product_name}"
        glass_categories = (
            'whisky', 'whiskies', 'whiskey', 'whiskeys', 'vin', 'vins',
            'wine', 'wines', 'champagne', 'champagnes', 'vodka', 'vodkas',
            'liqueur', 'liqueurs', 'spiritueux', 'rhum', 'rhums', 'rum',
            'rums', 'gin', 'gins', 'tequila', 'tequilas', 'cognac',
            'cognacs', 'brandy', 'brandies', 'aperitif', 'aperitifs',
            'apéritif', 'apéritifs',
        )
        return any(token in searchable_name for token in glass_categories)
    
    def save(self, *args, **kwargs):
        # Calcul automatique du prix de revient unitaire si on achète par casier
        if self.strategie_gestion == 'CASIER' and self.bouteilles_par_casier and self.bouteilles_par_casier > 0:
            from decimal import Decimal
            self.prix_achat_unitaire = self.prix_achat_casier / Decimal(self.bouteilles_par_casier)
        super().save(*args, **kwargs)
    
    @property
    def marge_pourcentage(self):
        """Calcule la marge estimée selon votre modèle visuel."""
        if self.prix_vente_unitaire > 0 and self.prix_achat_unitaire > 0:
            gain = self.prix_vente_unitaire - self.prix_achat_unitaire
            return (gain / self.prix_vente_unitaire) * 100
        return 0

    @property
    def cout_revient(self):
        return self.prix_achat_unitaire

class StockSupply(models.Model):
    """
    Modèle enregistrant chaque achat de stock (Arrivage).
    Conforme au modèle visuel (Casiers x Quantité).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='approvisionnements')
    
    # Détails de l'achat
    casiers_achetes = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    bouteilles_par_casier = models.IntegerField(default=24)
    
    # Prix d'achat à cet instant T
    prix_achat_casier = models.DecimalField(max_digits=12, decimal_places=2)
    devise = models.CharField(max_length=3, choices=StockItem.CURRENCY_CHOICES, default='USD')
    
    date_achat = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        from decimal import Decimal
        # Calcul du nombre total de bouteilles ajoutées
        total_bouteilles = Decimal(self.casiers_achetes) * Decimal(self.bouteilles_par_casier)
        
        # Mise à jour du stock global sur l'item
        self.item.quantite_actuelle += total_bouteilles
        # Mise à jour des infos de prix de revient sur l'item pour le calcul de marge
        self.item.prix_achat_unitaire = self.prix_achat_casier / Decimal(self.bouteilles_par_casier)
        self.item.save()
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Achat {self.casiers_achetes} casiers de {self.item.produit.nom} - {self.date_achat.strftime('%d/%m/%Y')}"

class Sale(models.Model):
    """
    Transactions de vente réalisées dans le Bar.
    Alimente le Dashboard en temps réel.
    """
    UNIT_CHOICES = [
        ('BOUTEILLE', 'Bouteille'),
        ('VERRE', 'Verre'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='ventes')
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True)
    item = models.ForeignKey(StockItem, on_delete=models.PROTECT)
    
    unite_vente = models.CharField(max_length=20, choices=UNIT_CHOICES, default='BOUTEILLE')
    quantite = models.IntegerField(default=1) # Nb de verres ou Nb de bouteilles
    prix_unitaire_applique = models.DecimalField(max_digits=12, decimal_places=2)
    devise = models.CharField(max_length=3, default='USD')
    
    date_vente = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        from decimal import Decimal
        # Si c'est une nouvelle vente, on déduit du stock
        if not self.pk:
            reduction = Decimal(0)
            if self.unite_vente == 'BOUTEILLE':
                reduction = Decimal(self.quantite)
            elif self.unite_vente == 'VERRE':
                # On calcule la fraction de bouteille : (Nb verres * Vol Verre) / Vol Total Bouteille
                vol_verre = Decimal(self.item.volume_verre_cl or 5)
                vol_total = Decimal(self.item.produit.volume_cl or 100)
                reduction = (Decimal(self.quantite) * vol_verre) / vol_total
            
            self.item.quantite_actuelle = max(Decimal(0), self.item.quantite_actuelle - reduction)
            self.item.save()
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Vente {self.item.produit.nom} x{self.quantite} - {self.date_vente.strftime('%H:%M')}"

class Order(models.Model):
    """
    Un ticket client regroupant plusieurs consommations.
    Permet de suivre le statut du service et du paiement.
    """
    STATUS_CHOICES = [
        ('PENDING', 'En attente'),
        ('ACCEPTEE', 'Acceptée'),
        ('PREPARING', 'En préparation'),
        ('SERVED', 'Servi'),
        ('PAID', 'Payé'),
        ('CANCELLED', 'Annulé'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='orders')
    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name='orders')
    serveur = models.ForeignKey(PilotProfile, on_delete=models.SET_NULL, null=True, blank=True)
    
    statut = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    client_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nom du Client")
    client_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Téléphone du Client")
    
    # Totaux (calculés)
    total_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cdf = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    date_creation = models.DateTimeField(auto_now_add=True)
    date_maj = models.DateTimeField(auto_now=True)
    date_service = models.DateTimeField(null=True, blank=True) # Quand le dernier item est servi

    def recalculate_totals(self):
        """Calcule les sommes totales par devise."""
        from django.db.models import Sum
        sums = self.items.values('devise').annotate(total=Sum(models.F('quantite') * models.F('prix_unitaire')))
        
        self.total_usd = 0
        self.total_cdf = 0
        
        for entry in sums:
            if entry['devise'] == 'USD':
                self.total_usd = entry['total']
            elif entry['devise'] == 'CDF':
                self.total_cdf = entry['total']
        
        self.save(update_fields=['total_usd', 'total_cdf'])

    def __str__(self):
        return f"Order {self.id.hex[:6]} - {self.table.nom} ({self.get_statut_display()})"

class OrderItem(models.Model):
    """
    Ligne détail d'une commande.
    """
    ITEM_STATUS = [
        ('ORDERED', 'Commandé'),
        ('SERVED', 'Servi'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product_item = models.ForeignKey(StockItem, on_delete=models.PROTECT)
    unite_vente = models.CharField(max_length=20, choices=Sale.UNIT_CHOICES, default='BOUTEILLE')
    quantite = models.IntegerField(default=1)
    prix_unitaire = models.DecimalField(max_digits=12, decimal_places=2)
    devise = models.CharField(max_length=3, default='USD')
    statut = models.CharField(max_length=20, choices=ITEM_STATUS, default='ORDERED')
    
    date_creation = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.quantite}x {self.product_item.produit.nom}"

class StaffShift(models.Model):
    """
    Suit les sessions de travail des serveurs.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'En service'),
        ('BREAK', 'En pause'),
        ('CLOSED', 'Service terminé'),
    ]

    worker = models.ForeignKey(PilotProfile, on_delete=models.CASCADE, related_name='shifts')
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='staff_shifts')
    
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ACTIVE')

    def __str__(self):
        return f"Shift {self.worker.prenom} - {self.status} ({self.start_time.strftime('%H:%M')})"

class Facture(models.Model):
    """
    Modèle pour gérer les factures (Dettes clients ou Dépenses fournisseurs).
    """
    TYPE_CHOICES = [
        ('CLIENT', 'Dette Client'),
        ('FOURNISSEUR', 'Dépense Fournisseur'),
    ]
    STATUS_CHOICES = [
        ('PAYEE', 'Payée'),
        ('IMPAYEE', 'Impayée'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='factures')
    numero = models.CharField(max_length=50, unique=True, verbose_name="Numéro de Facture")
    client_fournisseur = models.CharField(max_length=255, verbose_name="Nom du Client / Fournisseur")
    
    montant_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    montant_cdf = models.DecimalField(max_digits=15, decimal_places=0, default=0)
    
    type_facture = models.CharField(max_length=20, choices=TYPE_CHOICES, default='CLIENT')
    statut = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IMPAYEE')
    
    date_emission = models.DateTimeField(auto_now_add=True)
    date_echeance = models.DateTimeField(null=True, blank=True)
    date_paiement = models.DateTimeField(null=True, blank=True)
    
    orders = models.ManyToManyField(Order, related_name='factures', blank=True)
    guaranteed_by = models.ForeignKey(
        PilotProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='guaranteed_factures',
        verbose_name="Garant",
    )
    notes = models.TextField(blank=True, null=True)


class Notification(models.Model):
    CATEGORY_CHOICES = [
        ('ORDER', 'Commande'),
        ('DEBT', 'Dette'),
        ('TABLE', 'Table'),
        ('TEAM', 'Equipe'),
        ('SYSTEM', 'Systeme'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notifications')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='SYSTEM')
    title = models.CharField(max_length=160)
    message = models.TextField(blank=True)
    url = models.CharField(max_length=255, blank=True)
    dedupe_key = models.CharField(max_length=180, unique=True, null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'read_at', '-created_at'], name='notif_rec_read_idx'),
            models.Index(fields=['bar', '-created_at'], name='notif_bar_created_idx'),
        ]

    @property
    def is_read(self):
        return self.read_at is not None

    def mark_read(self):
        if not self.read_at:
            from django.utils import timezone
            self.read_at = timezone.now()
            self.save(update_fields=['read_at'])

    def __str__(self):
        return f"{self.title} -> {self.recipient}"


class FCMDeviceToken(models.Model):
    PLATFORM_CHOICES = [
        ('web', 'Web'),
        ('android', 'Android'),
        ('ios', 'iOS'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fcm_device_tokens')
    token = models.TextField(unique=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='web')
    user_agent = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_active'], name='fcm_user_active_idx'),
        ]

    def __str__(self):
        return f'{self.user} - {self.platform}'

def grant_trial_if_eligible(profile, bar):
    from django.utils import timezone
    from datetime import timedelta

    if not profile or not bar:
        return False

    if profile.trial_consumed_at:
        return False

    bar.abonnement_expire_le = timezone.now() + timedelta(days=30)
    bar.save(update_fields=['abonnement_expire_le'])
    profile.trial_consumed_at = timezone.now()
    profile.save(update_fields=['trial_consumed_at'])
    return True


def get_request_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def record_owner_audit(profile, bar, event_type, request=None, details=None):
    metadata = details or {}
    ip_address = ''
    user_agent = ''
    path = ''
    if request is not None:
        ip_address = get_request_ip(request)
        user_agent = (request.META.get('HTTP_USER_AGENT') or '')[:500]
        path = request.path[:255]
    OwnerAccessLog.objects.create(
        profile=profile,
        user=profile.user if profile else None,
        bar=bar,
        event_type=event_type,
        ip_address=ip_address,
        user_agent=user_agent,
        path=path,
        details=metadata,
    )


class OwnerAccessLog(models.Model):
    EVENT_CHOICES = [
        ('BAR_CREATED', 'Bar créé'),
        ('TRIAL_GRANTED', 'Essai accordé'),
        ('TRIAL_DENIED', 'Essai refusé'),
        ('BAR_SWITCHED', 'Bar basculé'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(PilotProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='access_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='owner_access_logs')
    bar = models.ForeignKey(Bar, on_delete=models.SET_NULL, null=True, blank=True, related_name='access_logs')
    event_type = models.CharField(max_length=30, choices=EVENT_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    path = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_type', '-created_at'], name='owner_audit_event_idx'),
            models.Index(fields=['bar', '-created_at'], name='owner_audit_bar_idx'),
            models.Index(fields=['profile', '-created_at'], name='owner_audit_profile_idx'),
        ]

    def __str__(self):
        return f'{self.event_type} - {self.user or self.profile or "anonymous"}'


class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='clients')
    nom = models.CharField(max_length=255, verbose_name="Nom du client")
    telephone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Numéro de téléphone")
    dette_autorisee = models.BooleanField(default=False, verbose_name="Autorisé explicitement à la dette")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Client"
        verbose_name_plural = "Clients"
        ordering = ['-date_creation']

    def __str__(self):
        return f"{self.nom} ({self.telephone or 'Sans tél'})"

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_pilot_profile(sender, instance, created, **kwargs):
    if created:
        PilotProfile.objects.get_or_create(user=instance)

@receiver(post_save, sender=User)
def save_pilot_profile(sender, instance, **kwargs):
    PilotProfile.objects.get_or_create(user=instance)

@receiver([post_save, post_delete], sender=OrderItem)
def update_order_totals(sender, instance, **kwargs):
    """Met à jour le ticket parent dès qu'une ligne change."""
    if instance.order:
        instance.order.recalculate_totals()
