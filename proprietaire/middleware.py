from django.utils import timezone
from datetime import timedelta
from django.contrib.sessions.models import Session
from django.http import JsonResponse
import logging

logger = logging.getLogger(__name__)

class SessionManagementMiddleware:
    """Middleware pour la gestion automatique des sessions"""
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Nettoyer les sessions expirées
        self.cleanup_expired_sessions()
        
        response = self.get_response(request)
        
        # Ajouter des headers de session pour le débogage
        if hasattr(request, 'session') and request.session.session_key:
            response['X-Session-Key'] = request.session.session_key
            response['X-Session-Expires'] = str(request.session.get_expiry_date())
        
        return response
    
    def cleanup_expired_sessions(self):
        """Nettoie les sessions expirées dans la base de données"""
        try:
            expired_count = Session.objects.filter(expire_date__lt=timezone.now()).delete()[0]
            if expired_count > 0:
                logger.info(f"Nettoyé {expired_count} sessions expirées")
        except Exception as e:
            logger.error(f"Erreur lors du nettoyage des sessions: {e}")

class SecurityHeadersMiddleware:
    """Middleware pour les headers de sécurité"""
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Headers de sécurité
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        return response

class RoleRouteAccessMiddleware:
    """Keep owner and waiter HTML/API route groups separated by PilotProfile.role."""

    OWNER_PREFIXES = ('/proprietaire/', '/api/proprietaire/')
    WAITER_PREFIXES = ('/serveur/', '/api/serveur/')
    WAITER_PERMISSION_PREFIXES = {
        '/api/serveur/inventory/': 'inventory_access_granted',
        '/api/serveur/tables/': 'tables_access_granted',
        '/api/serveur/reports/': 'reports_access_granted',
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            self._mark_user_seen(request)
            blocked_response = self._blocked_response(request)
            if blocked_response is not None:
                return blocked_response
        return self.get_response(request)

    def _mark_user_seen(self, request):
        from proprietaire.models import PilotProfile

        now = timezone.now()
        last_saved = request.session.get('last_seen_saved_at')
        if last_saved:
            try:
                last_saved_dt = timezone.datetime.fromisoformat(last_saved)
                if timezone.is_naive(last_saved_dt):
                    last_saved_dt = timezone.make_aware(last_saved_dt, timezone.get_current_timezone())
                if now - last_saved_dt < timedelta(seconds=30):
                    return
            except (TypeError, ValueError):
                pass

        PilotProfile.objects.filter(user=request.user).update(last_seen=now)
        request.session['last_seen_saved_at'] = now.isoformat()

    def _blocked_response(self, request):
        from django.shortcuts import redirect
        from proprietaire.models import PilotProfile
        from serveur.models import ServeurProfile

        path = request.path_info or request.path
        is_owner_route = path.startswith(self.OWNER_PREFIXES)
        is_waiter_route = path.startswith(self.WAITER_PREFIXES)
        if not is_owner_route and not is_waiter_route:
            return None

        try:
            pilot_profile = request.user.pilot_profile
            role = pilot_profile.role
        except (PilotProfile.DoesNotExist, AttributeError):
            return self._deny_or_redirect(request, 'select_role')

        if role == 'PROPRIETAIRE' and is_waiter_route:
            return self._deny_or_redirect(request, 'dashboard_html')
        if role == 'SERVEUR':
            if is_owner_route:
                return self._deny_or_redirect(request, 'serveur_dashboard')
            required_permission = self._waiter_permission_for_path(path)
            if required_permission and not path.startswith('/api/'):
                serveur_profile = ServeurProfile.objects.filter(user=request.user).first()
                if not serveur_profile or not getattr(serveur_profile, required_permission, False):
                    return self._deny_or_redirect(request, 'serveur_dashboard')
        return None

    def _waiter_permission_for_path(self, path):
        for prefix, permission in self.WAITER_PERMISSION_PREFIXES.items():
            if path.startswith(prefix):
                return permission
        return None

    def _deny_or_redirect(self, request, route_name):
        from django.http import JsonResponse
        from django.shortcuts import redirect

        if request.path_info.startswith('/api/'):
            return JsonResponse({'detail': 'Access denied for this role.'}, status=403)
        return redirect(route_name)
