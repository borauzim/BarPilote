from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin

class ServeurDashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'serveur/dashboard.html'

    def get_context_data(self, **kwargs):
        from proprietaire.models import PilotProfile, StockItem
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        context['profile'] = profile
        if profile.bar:
            context['inventory_items'] = StockItem.objects.filter(bar=profile.bar).select_related('produit')
        return context
