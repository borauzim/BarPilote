from django.utils import timezone
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
