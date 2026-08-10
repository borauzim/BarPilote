from django.views import View
from django.shortcuts import redirect
from proprietaire.models import PilotProfile

class RootRedirectView(View):
    """
    Redirige automatiquement l'utilisateur depuis la racine (/) vers son dashboard 
    ou vers la page de login s'il n'est pas connecté.
    """
    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login_html')
            
        try:
            profile = PilotProfile.objects.get(user=request.user)
            if profile.role == 'PROPRIETAIRE':
                return redirect('dashboard_html')
            elif profile.role == 'SERVEUR':
                return redirect('serveur_dashboard')
            else:
                return redirect('dashboard_html')
        except PilotProfile.DoesNotExist:
            return redirect('select_role')
