from django.db import models
from django.contrib.auth.models import User
from proprietaire.models import Bar, PilotProfile
from django.utils import timezone

class ServeurProfile(models.Model):
    """Profil du serveur avec informations personnelles et affectation"""
    SEXE_CHOICES = [
        ('M', 'Masculin'),
        ('F', 'Féminin'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='serveur_profile')
    nom = models.CharField(max_length=100)
    postnom= models.CharField(max_length=100, blank=True)
    prenom = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    telephone = models.CharField(max_length=20, blank=True)
    age = models.PositiveIntegerField(null=True, blank=True, verbose_name="Âge")
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES, default='M', verbose_name="Sexe")
    photo = models.ImageField(upload_to='serveur_photos/', blank=True, null=True)
    bar = models.ForeignKey(Bar, on_delete=models.SET_NULL, null=True, blank=True, related_name='serveurs')
    date_embauche = models.DateField(auto_now_add=True)
    actif = models.BooleanField(default=True)
    inventory_access_granted = models.BooleanField(default=False, verbose_name="Accès inventaire autorisé")
    tables_access_granted = models.BooleanField(default=False, verbose_name="Accès tables autorisé")
    reports_access_granted = models.BooleanField(default=False, verbose_name="Accès rapports autorisé")
    confirmation_status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'En attente de confirmation'),
            ('CONFIRMED', 'Confirmé par le propriétaire'),
            ('REJECTED', 'Rejeté par le propriétaire'),
        ],
        default='PENDING',
        verbose_name="Statut de confirmation"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Serveur"
        verbose_name_plural = "Serveurs"

    def __str__(self):
        return f"{self.prenom} {self.nom} - {self.bar.nom if self.bar else 'Non assigné'}"

    def can_access_inventory(self):
        return self.confirmation_status == 'CONFIRMED' and self.inventory_access_granted

    def can_access_tables(self):
        return self.confirmation_status == 'CONFIRMED' and self.tables_access_granted

    def can_access_reports(self):
        return self.confirmation_status == 'CONFIRMED' and self.reports_access_granted

class InvitationCode(models.Model):
    """Code d'invitation pour lier un serveur à un bar"""
    code = models.CharField(max_length=50, unique=True)
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='invitation_codes')
    proprietaire = models.ForeignKey(PilotProfile, on_delete=models.CASCADE, related_name='invitation_codes')
    is_used = models.BooleanField(default=False)
    used_by = models.ForeignKey('ServeurProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='used_invitation')
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = "Code d'invitation"
        verbose_name_plural = "Codes d'invitation"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.code} - {self.bar.nom}"
    
    def is_valid(self):
        """Vérifie si le code d'invitation est valide"""
        if self.is_used:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True

class Shift(models.Model):
    """Quart de travail du serveur"""
    STATUT_CHOICES = [
        ('ACTIVE', 'Actif'),
        ('BREAK', 'Pause'),
        ('ENDED', 'Terminé'),
    ]
    
    serveur = models.ForeignKey(ServeurProfile, on_delete=models.CASCADE, related_name='shifts')
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='shifts')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUT_CHOICES, default='ACTIVE')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quart de travail"
        verbose_name_plural = "Quarts de travail"
        ordering = ['-created_at']

    def __str__(self):
        return f"Shift {self.serveur.prenom} - {self.start_time.strftime('%d/%m %H:%M')}"

class CommandeServeur(models.Model):
    """Commande gérée par le serveur"""
    STATUT_CHOICES = [
        ('PENDING', 'En attente'),
        ('CONFIRMED', 'Confirmée'),
        ('PREPARING', 'En préparation'),
        ('READY', 'Prête'),
        ('SERVED', 'Servie'),
        ('PAID', 'Payée'),
    ]
    
    numero = models.CharField(max_length=20, unique=True)
    serveur = models.ForeignKey(ServeurProfile, on_delete=models.CASCADE, related_name='commandes')
    bar = models.ForeignKey(Bar, on_delete=models.CASCADE, related_name='commandes')
    table = models.CharField(max_length=10, blank=True)
    statut = models.CharField(max_length=15, choices=STATUT_CHOICES, default='PENDING')
    total_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_cdf = models.DecimalField(max_digits=15, decimal_places=0, default=0)
    notes = models.TextField(blank=True)
    heure_commande = models.DateTimeField(auto_now_add=True)
    heure_serve = models.DateTimeField(null=True, blank=True)
    heure_paiement = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Commande serveur"
        verbose_name_plural = "Commandes serveurs"
        ordering = ['-created_at']

    def __str__(self):
        return f"Commande #{self.numero} - Table {self.table}"
