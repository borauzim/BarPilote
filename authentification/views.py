import secrets
from email.mime.image import MIMEImage

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.contrib.staticfiles import finders
from django.core.validators import validate_email
from django.shortcuts import redirect, render
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from django.views.generic import TemplateView, View
from proprietaire.models import PilotProfile, Category, MasterProduct, StockItem
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

from .models import EmailLoginCode


LOGIN_CODE_SESSION_KEY = 'pending_login_email'
LOGIN_CODE_TTL_MINUTES = 15


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


def _normalize_email(email):
    return User.objects.normalize_email((email or '').strip()).lower()


def _generate_login_code():
    return f'{secrets.randbelow(1000000):06d}'


def _hash_login_code(email, code):
    return salted_hmac(
        'authentification.email_login_code',
        f'{email}:{code}',
        secret=settings.SECRET_KEY,
        algorithm='sha256',
    ).hexdigest()


def _find_or_create_user(email):
    user = User.objects.filter(email__iexact=email).order_by('id').first()
    if user:
        return user

    base_username = email.split('@', 1)[0] or 'user'
    username = base_username[:140]
    suffix = 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f'{base_username[:130]}{suffix}'

    user = User(username=username, email=email)
    user.set_unusable_password()
    user.save()
    return user


def _send_login_code(email):
    now = timezone.now()
    EmailLoginCode.objects.filter(
        email__iexact=email,
        used_at__isnull=True,
        expires_at__gt=now,
    ).update(used_at=now)

    code = _generate_login_code()
    login_code = EmailLoginCode.objects.create(
        email=email,
        code_hash=_hash_login_code(email, code),
        expires_at=now + timezone.timedelta(minutes=LOGIN_CODE_TTL_MINUTES),
    )

    try:
        text_body = (
            f"Votre code de connexion BarPilote est {code}.\n\n"
            f"Il expire dans {LOGIN_CODE_TTL_MINUTES} minutes. "
            "Si vous n’avez pas demandé ce code, ignorez ce message."
        )
        html_body = render_to_string(
            "authentification/emails/login_code.html",
            {"code": code, "ttl_minutes": LOGIN_CODE_TTL_MINUTES},
        )
        message = EmailMultiAlternatives(
            subject="Votre code de connexion BarPilote",
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        message.attach_alternative(html_body, "text/html")

        logo_path = finders.find("logo_orange.png")
        if logo_path:
            with open(logo_path, "rb") as logo_file:
                logo = MIMEImage(logo_file.read(), _subtype="png")
            logo.add_header("Content-ID", "<barpilote-logo>")
            logo.add_header("Content-Disposition", "inline", filename="barpilote.png")
            message.attach(logo)
        message.send(fail_silently=False)
    except Exception:
        login_code.delete()
        raise

    return login_code


class LoginView(TemplateView):
    template_name = 'authentification/login.html'

    def get(self, request, *args, **kwargs):
        # Si l'utilisateur est déjà connecté, on le redirige
        if request.user.is_authenticated:
            return redirect('login_redirect')
        return super().get(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('login_redirect')

        email = _normalize_email(request.POST.get('email'))
        try:
            validate_email(email)
        except ValidationError:
            messages.error(request, "Veuillez entrer une adresse email valide.")
            return render(request, self.template_name, {'email': request.POST.get('email', '')})

        try:
            _send_login_code(email)
        except Exception:
            messages.error(request, "Impossible d'envoyer le code pour le moment. Verifiez la configuration email.")
            return render(request, self.template_name, {"email": email})

        request.session[LOGIN_CODE_SESSION_KEY] = email
        messages.success(request, "Un code a 6 chiffres vient d'etre envoye a votre adresse email.")
        return redirect('verify_email_login')


class VerifyEmailLoginView(View):
    template_name = 'authentification/verify_email_login.html'

    def _context(self, email):
        login_code = EmailLoginCode.objects.filter(
            email__iexact=email, used_at__isnull=True,
        ).order_by("-created_at").first()
        remaining_seconds = 0
        if login_code:
            remaining_seconds = max(0, int((login_code.expires_at - timezone.now()).total_seconds()))
        return {"email": email, "remaining_seconds": remaining_seconds}

    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('login_redirect')
        email = request.session.get(LOGIN_CODE_SESSION_KEY)
        if not email:
            return redirect('login_html')
        return render(request, self.template_name, self._context(email))

    def post(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('login_redirect')

        email = request.session.get(LOGIN_CODE_SESSION_KEY)
        if not email:
            messages.error(request, "Demandez un nouveau code de connexion.")
            return redirect('login_html')

        if request.POST.get('action') == 'resend_code':
            try:
                _send_login_code(email)
            except Exception:
                messages.error(request, "Impossible d'envoyer un nouveau code pour le moment.")
            else:
                messages.success(request, "Un nouveau code a 6 chiffres vient d'etre envoye a votre adresse email.")
            return render(request, self.template_name, self._context(email))

        code = ''.join(ch for ch in request.POST.get('code', '') if ch.isdigit())
        if len(code) != 6:
            messages.error(request, "Le code doit contenir 6 chiffres.")
            return render(request, self.template_name, self._context(email))

        login_code = EmailLoginCode.objects.filter(
            email__iexact=email,
            used_at__isnull=True,
        ).order_by('-created_at').first()

        if not login_code or not login_code.is_usable:
            messages.error(request, "Ce code est expire. Demandez un nouveau code.")
            return render(request, self.template_name, self._context(email))

        expected_hash = _hash_login_code(email, code)
        if not constant_time_compare(login_code.code_hash, expected_hash):
            login_code.attempts += 1
            login_code.save(update_fields=['attempts'])
            messages.error(request, "Code incorrect.")
            return render(request, self.template_name, self._context(email))

        login_code.used_at = timezone.now()
        login_code.save(update_fields=['used_at'])
        user = _find_or_create_user(email)
        if not user.is_active:
            messages.error(request, "Ce compte est desactive.")
            return redirect('login_html')

        request.session.pop(LOGIN_CODE_SESSION_KEY, None)
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        return redirect('login_redirect')


class LoginRedirectView(LoginRequiredMixin, View):
    """
    Vue appelée après une connexion réussie (via Google ou autre).
    Elle vérifie si l'utilisateur a un PilotProfile et le redirige.
    """
    def get(self, request, *args, **kwargs):
        user = request.user
        if user.is_superuser:
            return redirect('administration_dashboard')
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

        # Afficher le catalogue complet. L'ancienne tranche [:40] masquait les nouvelles références.
        master_products = MasterProduct.objects.select_related('categorie').order_by(
            'categorie__nom', 'nom', 'volume_cl'
        )

        # Le filtrage est instantané dans le navigateur. Le catalogue complet
        # reste disponible pour changer de recherche ou de catégorie sans requête.

        # On récupère les IDs des produits déjà en stock pour l'affichage
        in_stock_ids = []
        if profile.bar:
            in_stock_ids = list(StockItem.objects.filter(bar=profile.bar).values_list('produit_id', flat=True))

        context['products'] = master_products
        context['in_stock_ids'] = in_stock_ids
        context['categories'] = Category.objects.order_by('nom')
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
