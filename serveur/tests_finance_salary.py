from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from proprietaire.models import Bar, PilotProfile
from serveur.models import ServeurProfile


class SalaryFinanceTests(TestCase):
    def test_salary_is_included_in_costs_and_net_profit(self):
        owner = User.objects.create_user(username='finance-salary-owner')
        server = User.objects.create_user(username='finance-salary-server')
        bar = Bar.objects.create(nom='Finance Salary Bar', adresse='Kinshasa')
        PilotProfile.objects.filter(user=owner).update(role='PROPRIETAIRE', bar=bar)
        ServeurProfile.objects.create(
            user=server, nom='Serveur', prenom='Test', email='finance-salary@example.com',
            bar=bar, confirmation_status='CONFIRMED', actif=True,
            salaire_mensuel=Decimal('300000'), salaire_devise='CDF',
        )
        self.client.force_login(owner)
        day = timezone.localdate().isoformat()

        response = self.client.get(reverse('finance_html'), {
            'start_date': day, 'end_date': day,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['salary_total_cdf'], Decimal('10000.00'))
        self.assertEqual(response.context['operating_costs_cdf'], Decimal('10000.00'))
        self.assertEqual(response.context['net_profit_cdf'], Decimal('-10000.00'))
        self.assertContains(response, 'Salaires intégrés aux finances')
