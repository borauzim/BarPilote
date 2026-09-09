from django.views import View
from django.shortcuts import redirect, render
from proprietaire.models import PilotProfile

class RootRedirectView(View):
    """
    Redirige automatiquement l'utilisateur depuis la racine (/) vers son dashboard 
    ou affiche la présentation de BarPilote s'il n'est pas connecté.
    """
    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return render(request, 'authentification/home.html')
        if request.user.is_superuser:
            return redirect('administration_dashboard')
            
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
