from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView, View
from proprietaire.models import PilotProfile, Category, MasterProduct, StockItem
from django.db.models import Q
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client

    @property
    def callback_url(self):
        # Callback URL for HTML Flow
        origin = self.request.META.get('HTTP_ORIGIN')
        if origin:
            return origin
        return "http://localhost:8000"

class LoginView(TemplateView):
    template_name = 'authentification/login.html'
    
    def get(self, request, *args, **kwargs):
        # Si l'utilisateur est déjà connecté, on le redirige
        if request.user.is_authenticated:
            return redirect('login_redirect')
        return super().get(request, *args, **kwargs)

class LoginRedirectView(LoginRequiredMixin, View):
    """
    Vue appelée après une connexion réussie (via Google ou autre).
    Elle vérifie si l'utilisateur a un PilotProfile et le redirige.
    """
    def get(self, request, *args, **kwargs):
        user = request.user
        try:
            profile = PilotProfile.objects.get(user=user)
            if not profile.role:
                return redirect('select_role')
                
            if profile.role == 'PROPRIETAIRE':
                # Tentative de récupération des infos Google si manquantes
                social_account = user.socialaccount_set.filter(provider='google').first()
                if social_account:
                    data = social_account.extra_data
                    if not profile.nom:
                        profile.nom = data.get('family_name', '').upper()
                    if not profile.prenom:
                        profile.prenom = data.get('given_name', '').capitalize()
                    profile.save()

                if not (profile.nom and profile.prenom and profile.telephone):
                    return redirect('profile_setup')
                if not profile.bar:
                    fallback_bar = profile.owned_bars.order_by('-date_creation').first()
                    if fallback_bar:
                        profile.bar = fallback_bar
                        profile.save(update_fields=['bar'])
                    else:
                        return redirect('establishment_setup')
                return redirect('dashboard_html')
            elif profile.role == 'SERVEUR':
                # Pour les serveurs, rediriger vers la page de scan/setup pour créer leur ServeurProfile
                return redirect('serveur_scan')
            else:
                return redirect('dashboard_html')
        except PilotProfile.DoesNotExist:
            # L'utilisateur vient de s'inscrire, il n'a pas de profil
            return redirect('select_role')

class SelectRoleView(LoginRequiredMixin, TemplateView):
    template_name = 'authentification/select_role.html'

    def get(self, request, *args, **kwargs):
        # Si l'utilisateur a déjà choisi un rôle, on l'empêche de re-sélectionner
        try:
            profile = PilotProfile.objects.get(user=request.user)
            if profile.role:
                return redirect('login_redirect')
        except PilotProfile.DoesNotExist:
            pass
        return super().get(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        role = request.POST.get('role')
        if role in dict(PilotProfile.ROLE_CHOICES).keys():
            # Mettre à jour ou créer le PilotProfile
            profile, created = PilotProfile.objects.get_or_create(user=request.user)
            profile.role = role
            if not profile.prenom:
                profile.prenom = request.user.first_name
            if not profile.nom:
                profile.nom = request.user.last_name
            profile.save()
            return redirect('login_redirect')
        return redirect('select_role')

class CatalogueSetupView(LoginRequiredMixin, TemplateView):
    """
    Vue permettant d'ajouter des produits au stock du bar
    ou de créer de nouveaux produits dans le catalogue global.
    """
    template_name = 'authentification/catalogue_setup.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        
        # Recherche
        query = self.request.GET.get('q', '')
        category_id = self.request.GET.get('category', '')
        
        master_products = MasterProduct.objects.all()
        
        if query:
            master_products = master_products.filter(nom__icontains=query)
        if category_id:
            master_products = master_products.filter(categorie_id=category_id)
            
        # On récupère les IDs des produits déjà en stock pour l'affichage
        in_stock_ids = []
        if profile.bar:
            in_stock_ids = list(StockItem.objects.filter(bar=profile.bar).values_list('produit_id', flat=True))
            
        context['products'] = master_products[:40] # Plus de produits visibles
        context['in_stock_ids'] = in_stock_ids
        context['categories'] = Category.objects.all()
        context['bar'] = profile.bar
        context['query'] = query
        context['selected_category'] = category_id
        return context

    def post(self, request, *args, **kwargs):
        action = request.POST.get('action')
        profile = PilotProfile.objects.get(user=request.user)
        
        if not profile.bar:
            return redirect('establishment_setup')

        if action == 'add_to_stock':
            product_id = request.POST.get('product_id')
            product = MasterProduct.objects.get(id=product_id)
            
            StockItem.objects.get_or_create(
                bar=profile.bar,
                produit=product,
                defaults={
                    'prix_vente_unitaire': 0,
                    'quantite_actuelle': 0
                }
            )
            messages.success(request, f"Le produit '{product.nom}' a été ajouté à votre stock.")
            
        elif action == 'create_and_add':
            nom = request.POST.get('nom')
            categorie_id = request.POST.get('categorie_id')
            volume = request.POST.get('volume')
            photo = request.FILES.get('photo')
            
            # Création du produit dans le catalogue global
            category = Category.objects.get(id=categorie_id)
            new_product = MasterProduct.objects.create(
                nom=nom,
                categorie=category,
                volume=volume,
                photo=photo
            )
            
            # Ajout immédiat au stock
            StockItem.objects.create(
                bar=profile.bar,
                produit=new_product,
                prix_vente_unitaire=0,
                quantite_actuelle=0
            )
            messages.success(request, f"Le produit '{new_product.nom}' a été créé et ajouté à votre stock.")
            
        return redirect('catalogue_setup')
