from django.db import models
from django.contrib.auth.models import User
import uuid

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
    date_creation = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nom

def upload_pilot_photo(instance, filename):
    """Sépare les dossiers de stockage par rôle"""
    return f'profils/{instance.role.lower()}/{filename}'

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
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='PROPRIETAIRE', verbose_name="Rôle Exécutif")
    
    # Lien vers le Bar (Un propriétaire peut avoir un ou plusieurs bars)
    bar = models.ForeignKey(Bar, on_delete=models.SET_NULL, null=True, blank=True, related_name='proprietaires')
    
    # Champs d'identité (On sépare Nom, Postnom, Prénom pour plus de précision)
    nom = models.CharField(max_length=150, blank=True, verbose_name="Nom")
    postnom = models.CharField(max_length=150, blank=True, verbose_name="Postnom")
    prenom = models.CharField(max_length=150, blank=True, verbose_name="Prénom")
    
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES, blank=True, verbose_name="Sexe")
    telephone = models.CharField(max_length=20, blank=True, verbose_name="Numéro de téléphone")
    photo_profil = models.ImageField(upload_to=upload_pilot_photo, blank=True, null=True, verbose_name="Photo de Profil")
    
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
    quantite = models.PositiveIntegerField(default=1)
    raison = models.CharField(max_length=20, choices=RAISON_CHOICES, default='CASSE')
    commentaire = models.TextField(blank=True, null=True)
    date_perte = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Perte: {self.quantite} x {self.item.produit.nom} ({self.raison})"

    def __str__(self):
        return f"{self.nom} - {self.bar.nom}"

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

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_pilot_profile(sender, instance, created, **kwargs):
    if created:
        PilotProfile.objects.get_or_create(user=instance)

@receiver(post_save, sender=User)
def save_pilot_profile(sender, instance, **kwargs):
    if hasattr(instance, 'pilot_profile'):
        instance.pilot_profile.save()

@receiver([post_save, post_delete], sender=OrderItem)
def update_order_totals(sender, instance, **kwargs):
    """Met à jour le ticket parent dès qu'une ligne change."""
    if instance.order:
        instance.order.recalculate_totals()
