"""
URL configuration for barpilote project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from authentification.views import GoogleLogin
from authentification.root_views import RootRedirectView

from django.views.generic import RedirectView

urlpatterns = [
    path('', RootRedirectView.as_view(), name='root'),
    path('admin/', admin.site.urls),
    
    # Overrides Allauth local routes to force our custom page
    path('accounts/login/', RedirectView.as_view(pattern_name='login_html', permanent=False)),
    path('accounts/signup/', RedirectView.as_view(pattern_name='login_html', permanent=False)),
    
    # Authentification HTML (Nouvelle app)
    path('auth/', include('authentification.urls')),
    
    # Authentification API Route (dj-rest-auth)
    path('api/auth/', include('dj_rest_auth.urls')),
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),
    path('accounts/', include('allauth.urls')),
    
    # Proprietaire API & HTML
    path('api/proprietaire/', include('proprietaire.urls')),
    path('proprietaire/', include('proprietaire.html_urls')),
    
    # Serveur API & HTML
    path('api/serveur/', include('serveur.urls')),
    path('serveur/', include('serveur.html_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
