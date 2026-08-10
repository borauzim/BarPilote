from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from proprietaire.models import Bar, PilotProfile
from serveur.models import ServeurProfile


class TeamSalaryTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='salary-owner', password='pass')
        self.server = User.objects.create_user(username='salary-server', password='pass')
        self.bar = Bar.objects.create(nom='Salary Bar', adresse='Kinshasa')
        PilotProfile.objects.filter(user=self.owner).update(role='PROPRIETAIRE', bar=self.bar)
        self.server_profile = ServeurProfile.objects.create(
            user=self.server,
            nom='Serveur',
            prenom='Test',
            email='salary-server@example.com',
            bar=self.bar,
            confirmation_status='CONFIRMED',
            actif=True,
        )

    def test_owner_can_save_server_salary(self):
        self.client.force_login(self.owner)
        response = self.client.post(reverse('team_salary_action'), {
            'server_profile_id': self.server_profile.id,
            'salaire_mensuel': '250000',
            'salaire_devise': 'CDF',
        })

        self.assertRedirects(response, reverse('team_html'))
        self.server_profile.refresh_from_db()
        self.assertEqual(self.server_profile.salaire_mensuel, Decimal('250000.00'))
        self.assertEqual(self.server_profile.salaire_devise, 'CDF')

    def test_owner_cannot_change_salary_in_another_bar(self):
        other_owner = User.objects.create_user(username='other-owner', password='pass')
        other_bar = Bar.objects.create(nom='Other Bar', adresse='Kinshasa')
        PilotProfile.objects.filter(user=other_owner).update(role='PROPRIETAIRE', bar=other_bar)
        self.client.force_login(other_owner)

        response = self.client.post(reverse('team_salary_action'), {
            'server_profile_id': self.server_profile.id,
            'salaire_mensuel': '1',
            'salaire_devise': 'USD',
        })

        self.assertEqual(response.status_code, 404)
        self.server_profile.refresh_from_db()
        self.assertIsNone(self.server_profile.salaire_mensuel)
