from django.contrib.auth import login, logout
from django.contrib.sessions.models import Session
from django.utils import timezone
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from .models import PilotProfile
import json


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def session_info(request):
    """Retourne les informations de session actuelle"""
    user = request.user
    try:
        profile = PilotProfile.objects.get(user=user)
        return Response({
            'user_id': user.id,
            'email': user.email,
            'role': profile.role,
            'bar_id': profile.bar.id if profile.bar else None,
            'session_key': request.session.session_key,
            'session_created': request.session.creation_date,
            'last_activity': request.session.expire_date,
        })
    except PilotProfile.DoesNotExist:
        return Response({
            'user_id': user.id,
            'email': user.email,
            'role': None,
            'bar_id': None,
            'session_key': request.session.session_key,
        }, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_session(request):
    """Rafraîchit la session et prolonge sa durée"""
    if not request.session.exists(request.session.session_key):
        request.session.create()
    
    request.session.set_expiry(86400)  # 24 heures
    request.session.save()
    
    return Response({
        'message': 'Session rafraîchie',
        'session_key': request.session.session_key,
        'expires_at': request.session.expire_date,
    })

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def terminate_session(request):
    """Termine la session actuelle"""
    session_key = request.session.session_key
    if session_key:
        Session.objects.filter(session_key=session_key).delete()
    
    logout(request)
    return Response({'message': 'Session terminée'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def active_sessions(request):
    """Liste toutes les sessions actives de l'utilisateur"""
    user = request.user
    sessions = Session.objects.filter(
        session_data__contains=str(user.id)
    ).values('session_key', 'expire_date', 'session_data')
    
    return Response({
        'active_sessions': list(sessions),
        'current_session': request.session.session_key,
    })

@csrf_exempt
@require_http_methods(["POST"])
def validate_session(request):
    """Valide une session sans authentification (pour les vérifications)"""
    try:
        data = json.loads(request.body)
        session_key = data.get('session_key')
        
        if not session_key:
            return Response({'valid': False, 'error': 'Session key required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        session = Session.objects.filter(session_key=session_key, expire_date__gt=timezone.now()).first()
        
        if session:
            return Response({'valid': True, 'expires_at': session.expire_date})
        else:
            return Response({'valid': False, 'error': 'Session expired or not found'})
            
    except json.JSONDecodeError:
        return Response({'valid': False, 'error': 'Invalid JSON'}, 
                      status=status.HTTP_400_BAD_REQUEST)

            
    except PilotProfile.DoesNotExist:
        # Pas de profil → sélection de rôle
        print(f"Pas de profil pour l'utilisateur {user.email}, redirection vers sélection rôle")
        return Response({
            'redirect_url': '/auth/select-role',
            'message': 'Aucun profil détecté, sélection de rôle requise',
            'has_profile': False
        })
    except Exception as e:
        print(f"Erreur dans auto_redirect: {e}")
        return Response({
            'error': f'Erreur lors de la redirection: {str(e)}',
            'redirect_url': '/auth/select-role'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def login_redirect(request):
    """
    Vue appelée après la connexion Google pour déterminer la redirection.
    Retourne l'URL appropriée selon le profil de l'utilisateur.
    """
    return auto_redirect(request)
