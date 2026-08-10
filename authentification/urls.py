from django.urls import path
from .views import LoginView, LoginRedirectView, SelectRoleView, CatalogueSetupView, VerifyEmailLoginView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login_html'),
    path('login/verify/', VerifyEmailLoginView.as_view(), name='verify_email_login'),
    path('login/redirect/', LoginRedirectView.as_view(), name='login_redirect'),
    path('select-role/', SelectRoleView.as_view(), name='select_role'),
    path('catalogue-setup/', CatalogueSetupView.as_view(), name='catalogue_setup'),
]
