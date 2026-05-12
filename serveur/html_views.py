from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin

class ServeurDashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'serveur/dashboard.html'
