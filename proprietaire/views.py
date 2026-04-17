from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client

    @property
    def callback_url(self):
        # Support dynamique pour localhost:3000 et localhost:3001
        origin = self.request.META.get('HTTP_ORIGIN')
        if origin:
            return origin
        return "http://localhost:3000"
