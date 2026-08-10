from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from .models import EmailLoginCode
from .views import _hash_login_code


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class EmailLoginCodeTests(TestCase):
    def test_login_request_sends_six_digit_code(self):
        response = self.client.post(reverse('login_html'), {'email': 'Test@Example.com'})

        self.assertRedirects(response, reverse('verify_email_login'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('test@example.com', mail.outbox[0].to)
        login_code = EmailLoginCode.objects.get(email='test@example.com')
        self.assertEqual(len(login_code.code_hash), 64)
        self.assertGreater(login_code.expires_at, timezone.now())
        self.assertLessEqual(login_code.expires_at, timezone.now() + timezone.timedelta(minutes=15, seconds=5))

    def test_valid_code_creates_user_and_logs_in(self):
        email = 'new@example.com'
        code = '123456'
        self.client.session['pending_login_email'] = email
        session = self.client.session
        session['pending_login_email'] = email
        session.save()
        EmailLoginCode.objects.create(
            email=email,
            code_hash=_hash_login_code(email, code),
            expires_at=timezone.now() + timezone.timedelta(minutes=15),
        )

        response = self.client.post(reverse('verify_email_login'), {'code': code})

        self.assertRedirects(response, reverse('login_redirect'), fetch_redirect_response=False)
        user = User.objects.get(email=email)
        self.assertEqual(int(self.client.session['_auth_user_id']), user.id)
        self.assertTrue(EmailLoginCode.objects.get(email=email).used_at)

    def test_invalid_code_increments_attempts(self):
        email = 'known@example.com'
        session = self.client.session
        session['pending_login_email'] = email
        session.save()
        login_code = EmailLoginCode.objects.create(
            email=email,
            code_hash=_hash_login_code(email, '123456'),
            expires_at=timezone.now() + timezone.timedelta(minutes=15),
        )

        response = self.client.post(reverse('verify_email_login'), {'code': '000000'})

        self.assertEqual(response.status_code, 200)
        login_code.refresh_from_db()
        self.assertEqual(login_code.attempts, 1)
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_expired_code_is_rejected(self):
        email = 'expired@example.com'
        session = self.client.session
        session['pending_login_email'] = email
        session.save()
        EmailLoginCode.objects.create(
            email=email,
            code_hash=_hash_login_code(email, '123456'),
            expires_at=timezone.now() - timezone.timedelta(seconds=1),
        )

        response = self.client.post(reverse('verify_email_login'), {'code': '123456'})

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'authentification/verify_email_login.html')
        self.assertFalse(User.objects.filter(email=email).exists())

    def test_resend_code_stays_on_verify_page_and_invalidates_previous_code(self):
        email = 'resend@example.com'
        session = self.client.session
        session['pending_login_email'] = email
        session.save()
        old_code = EmailLoginCode.objects.create(
            email=email,
            code_hash=_hash_login_code(email, '123456'),
            expires_at=timezone.now() + timezone.timedelta(minutes=15),
        )

        response = self.client.post(reverse('verify_email_login'), {'action': 'resend_code'})

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'authentification/verify_email_login.html')
        self.assertEqual(len(mail.outbox), 1)
        old_code.refresh_from_db()
        self.assertIsNotNone(old_code.used_at)
        self.assertEqual(EmailLoginCode.objects.filter(email=email, used_at__isnull=True).count(), 1)

