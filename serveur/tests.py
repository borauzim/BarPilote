from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from proprietaire.models import Bar, Category, MasterProduct, Order, Perte, PilotProfile, StockItem, Table
from serveur.invitations import extract_invitation_token, resolve_invitation
from serveur.models import InvitationCode, ServeurProfile, Shift


class InvitationParsingTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", email="owner@example.com", password="pass")
        self.bar = Bar.objects.create(nom="Sky Lounge", adresse="Gombe, Kinshasa, RDC")
        PilotProfile.objects.filter(user=self.owner).update(
            role="PROPRIETAIRE",
            bar=self.bar,
            nom="Owner",
            prenom="Pat",
        )
        self.owner_profile = PilotProfile.objects.get(user=self.owner)

    def test_extracts_code_from_generated_join_url(self):
        url = f"https://barpilote.com/serveur/join/{self.bar.code_invitation}/"

        self.assertEqual(extract_invitation_token(url), str(self.bar.code_invitation))

    def test_resolves_bar_uuid_from_generated_join_url(self):
        url = f"https://barpilote.com/serveur/join/{self.bar.code_invitation}/"

        bar, invitation, token = resolve_invitation(url)

        self.assertEqual(bar, self.bar)
        self.assertIsNone(invitation)
        self.assertEqual(str(token), str(self.bar.code_invitation))

    def test_resolves_invitation_code_model(self):
        invitation = InvitationCode.objects.create(
            code="TEAM-1234",
            bar=self.bar,
            proprietaire=self.owner_profile,
        )

        bar, resolved_invitation, token = resolve_invitation("TEAM-1234")

        self.assertEqual(bar, self.bar)
        self.assertEqual(resolved_invitation, invitation)
        self.assertEqual(token, "TEAM-1234")


class ServeurInvitationFlowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", email="owner@example.com", password="pass")
        self.server = User.objects.create_user(
            username="waiter",
            email="waiter@example.com",
            password="pass",
            first_name="Jean",
            last_name="Mabika",
        )
        self.bar = Bar.objects.create(nom="Sky Lounge", adresse="Gombe, Kinshasa, RDC")
        PilotProfile.objects.filter(user=self.owner).update(
            role="PROPRIETAIRE",
            bar=self.bar,
            nom="Owner",
            prenom="Pat",
        )
        self.owner_profile = PilotProfile.objects.get(user=self.owner)

    def test_scan_post_accepts_generated_qr_url(self):
        self.client.force_login(self.server)
        qr_url = f"https://barpilote.com/serveur/join/{self.bar.code_invitation}/"

        response = self.client.post(reverse("serveur_scan"), {"invitation_code": qr_url})

        self.assertRedirects(response, reverse("serveur_setup"))
        profile = ServeurProfile.objects.get(user=self.server)
        self.assertEqual(profile.bar, self.bar)
        self.assertEqual(profile.confirmation_status, "PENDING")

    def test_join_route_links_profile_from_pdf_url(self):
        self.client.force_login(self.server)

        response = self.client.get(reverse("serveur_join", args=[str(self.bar.code_invitation)]))

        self.assertRedirects(response, reverse("serveur_setup"))
        self.assertTrue(ServeurProfile.objects.filter(user=self.server, bar=self.bar).exists())

    def test_verify_invitation_api_uses_expected_public_prefix(self):
        client = APIClient()
        client.force_authenticate(self.server)
        qr_url = f"https://barpilote.com/serveur/join/{self.bar.code_invitation}/"

        response = client.post("/api/serveur/verify-invitation/", {"invitation_code": qr_url}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["bar_id"], str(self.bar.id))
        self.assertEqual(response.data["bar_nom"], self.bar.nom)
        self.assertTrue(response.data["is_valid"])

    def test_verify_invitation_api_rejects_invalid_code(self):
        client = APIClient()
        client.force_authenticate(self.server)

        response = client.post("/api/serveur/verify-invitation/", {"invitation_code": "bad-code"}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)


class ServeurPendingApprovalTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner2", email="owner2@example.com", password="pass")
        self.server = User.objects.create_user(username="waiter2", email="waiter2@example.com", password="pass")
        self.bar = Bar.objects.create(nom="Moon Bar", adresse="Gombe, Kinshasa, RDC")
        PilotProfile.objects.filter(user=self.owner).update(
            role="PROPRIETAIRE",
            bar=self.bar,
            nom="Kabongo",
            prenom="Aline",
        )
        self.owner_profile = PilotProfile.objects.get(user=self.owner)
        self.server_profile = ServeurProfile.objects.create(
            user=self.server,
            nom="MABIKA",
            prenom="Jean",
            email=self.server.email,
            bar=self.bar,
            confirmation_status="PENDING",
            actif=True,
        )

    def test_pending_server_dashboard_is_empty_until_owner_approval(self):
        self.client.force_login(self.server)

        response = self.client.get(reverse("serveur_dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Awaiting confirmation from the owner (Aline Kabongo) of the establishment (Moon Bar).")
        self.assertContains(response, "Aucune operation disponible")

    def test_profile_setup_redirects_pending_server_to_dashboard(self):
        self.client.force_login(self.server)

        response = self.client.post(reverse("serveur_setup"), {
            "prenom": "Jean",
            "nom": "Mabika",
            "postnom": "",
            "sexe": "M",
            "telephone": "+243890000000",
            "age": "25",
        })

        self.assertRedirects(response, reverse("serveur_dashboard"))
        self.server_profile.refresh_from_db()
        self.assertEqual(self.server_profile.confirmation_status, "PENDING")

    def test_owner_team_page_shows_pending_request(self):
        self.client.force_login(self.owner)

        response = self.client.get(reverse("team_html"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Nouveaux membres en attente")
        self.assertContains(response, "Approve")
        self.assertContains(response, "Reject")
        self.assertContains(response, "Jean MABIKA")

    def test_owner_can_approve_pending_server(self):
        self.client.force_login(self.owner)

        response = self.client.post(reverse("team_request_action"), {
            "server_profile_id": self.server_profile.id,
            "action": "approve",
        })

        self.assertRedirects(response, reverse("team_html"))
        self.server_profile.refresh_from_db()
        self.assertEqual(self.server_profile.confirmation_status, "CONFIRMED")
        pilot_profile = PilotProfile.objects.get(user=self.server)
        self.assertEqual(pilot_profile.role, "SERVEUR")
        self.assertEqual(pilot_profile.bar, self.bar)

    def test_owner_can_reject_pending_server(self):
        self.client.force_login(self.owner)

        response = self.client.post(reverse("team_request_action"), {
            "server_profile_id": self.server_profile.id,
            "action": "reject",
        })

        self.assertRedirects(response, reverse("team_html"))
        self.server_profile.refresh_from_db()
        self.assertEqual(self.server_profile.confirmation_status, "REJECTED")
        self.assertFalse(self.server_profile.actif)


class ServeurPendingApprovalTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner2", email="owner2@example.com", password="pass")
        self.server = User.objects.create_user(username="waiter2", email="waiter2@example.com", password="pass")
        self.bar = Bar.objects.create(nom="Moon Bar", adresse="Gombe, Kinshasa, RDC")
        PilotProfile.objects.filter(user=self.owner).update(
            role="PROPRIETAIRE",
            bar=self.bar,
            nom="Kabongo",
            prenom="Aline",
        )
        self.owner_profile = PilotProfile.objects.get(user=self.owner)
        self.server_profile = ServeurProfile.objects.create(
            user=self.server,
            nom="MABIKA",
            prenom="Jean",
            email=self.server.email,
            bar=self.bar,
            confirmation_status="PENDING",
            actif=True,
        )

    def test_pending_server_dashboard_is_empty_until_owner_approval(self):
        self.client.force_login(self.server)

        response = self.client.get(reverse("serveur_dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Awaiting confirmation from the owner (Aline Kabongo) of the establishment (Moon Bar).")
        self.assertContains(response, "Aucune operation disponible")

    def test_profile_setup_redirects_pending_server_to_dashboard(self):
        self.client.force_login(self.server)

        response = self.client.post(reverse("serveur_setup"), {
            "prenom": "Jean",
            "nom": "Mabika",
            "postnom": "",
            "sexe": "M",
            "telephone": "+243890000000",
            "age": "25",
        })

        self.assertRedirects(response, reverse("serveur_dashboard"))
        self.server_profile.refresh_from_db()
        self.assertEqual(self.server_profile.confirmation_status, "PENDING")

    def test_owner_team_page_shows_pending_request(self):
        self.client.force_login(self.owner)

        response = self.client.get(reverse("team_html"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Nouveaux membres en attente")
        self.assertContains(response, "Approve")
        self.assertContains(response, "Reject")
        self.assertContains(response, "Jean MABIKA")

    def test_owner_can_approve_pending_server(self):
        self.client.force_login(self.owner)

        response = self.client.post(reverse("team_request_action"), {
            "server_profile_id": self.server_profile.id,
            "action": "approve",
        })

        self.assertRedirects(response, reverse("team_html"))
        self.server_profile.refresh_from_db()
        self.assertEqual(self.server_profile.confirmation_status, "CONFIRMED")
        pilot_profile = PilotProfile.objects.get(user=self.server)
        self.assertEqual(pilot_profile.role, "SERVEUR")
        self.assertEqual(pilot_profile.bar, self.bar)

    def test_owner_can_reject_pending_server(self):
        self.client.force_login(self.owner)

        response = self.client.post(reverse("team_request_action"), {
            "server_profile_id": self.server_profile.id,
            "action": "reject",
        })

        self.assertRedirects(response, reverse("team_html"))
        self.server_profile.refresh_from_db()
        self.assertEqual(self.server_profile.confirmation_status, "REJECTED")
        self.assertFalse(self.server_profile.actif)


class ServeurAccessGrantTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="access-owner", email="access-owner@example.com", password="pass")
        self.server = User.objects.create_user(username="access-waiter", email="access-waiter@example.com", password="pass")
        self.other_server = User.objects.create_user(username="other-waiter", email="other-waiter@example.com", password="pass")
        self.bar = Bar.objects.create(nom="Access Bar", adresse="Gombe, Kinshasa, RDC")
        self.table_1 = Table.objects.create(bar=self.bar, nom="Table 1")
        self.table_2 = Table.objects.create(bar=self.bar, nom="Table 2")
        self.category = Category.objects.create(nom="Whiskies")
        self.product = MasterProduct.objects.create(nom="Johnnie Walker", categorie=self.category, volume_cl=75)
        self.stock_item = StockItem.objects.create(
            bar=self.bar,
            produit=self.product,
            quantite_actuelle=10,
            prix_vente_unitaire=Decimal("50.00"),
            prix_vente_verre=Decimal("7.00"),
            devise="USD",
        )
        PilotProfile.objects.filter(user=self.owner).update(
            role="PROPRIETAIRE",
            bar=self.bar,
            nom="Owner",
            prenom="Access",
        )
        self.owner_profile = PilotProfile.objects.get(user=self.owner)
        PilotProfile.objects.filter(user=self.server).update(
            role="SERVEUR",
            bar=self.bar,
            nom="Waiter",
            prenom="Access",
        )
        PilotProfile.objects.filter(user=self.other_server).update(
            role="SERVEUR",
            bar=self.bar,
            nom="Other",
            prenom="Waiter",
        )
        self.server_profile = ServeurProfile.objects.create(
            user=self.server,
            nom="ACCESS",
            prenom="Jean",
            email=self.server.email,
            bar=self.bar,
            confirmation_status="CONFIRMED",
            actif=True,
        )
        self.other_server_profile = ServeurProfile.objects.create(
            user=self.other_server,
            nom="OTHER",
            prenom="Mia",
            email=self.other_server.email,
            bar=self.bar,
            confirmation_status="CONFIRMED",
            actif=True,
        )
        other_pilot = PilotProfile.objects.get(user=self.other_server)
        Order.objects.create(bar=self.bar, table=self.table_2, serveur=other_pilot, statut="PAID")
        Order.objects.create(bar=self.bar, table=self.table_1, serveur=PilotProfile.objects.get(user=self.server), statut="PAID")

    def grant_access(self, permission):
        self.client.force_login(self.owner)
        response = self.client.post(reverse("team_access_action"), {
            "server_profile_id": self.server_profile.id,
            "permission": permission,
            "enabled": "1",
        })
        self.assertRedirects(response, reverse("team_html"))

    def test_owner_can_grant_waiter_access_flags(self):
        self.grant_access("inventory")
        self.grant_access("tables")
        self.grant_access("reports")

        self.server_profile.refresh_from_db()
        self.assertTrue(self.server_profile.inventory_access_granted)
        self.assertTrue(self.server_profile.tables_access_granted)
        self.assertTrue(self.server_profile.reports_access_granted)

    def test_waiter_can_access_owner_style_sections_without_owner_authorization(self):
        self.client.force_login(self.server)

        inventory = self.client.get(reverse("serveur_inventory"))
        tables = self.client.get(reverse("serveur_tables"))
        finance = self.client.get(reverse("serveur_finance"))
        clients = self.client.get(reverse("serveur_clients"))
        team = self.client.get(reverse("serveur_team"))

        self.assertEqual(inventory.status_code, 200)
        self.assertContains(inventory, "Johnnie Walker")
        self.assertNotContains(inventory, "Modifier")
        self.assertEqual(tables.status_code, 200)
        self.assertContains(tables, "Table 1")
        self.assertEqual(finance.status_code, 200)
        self.assertContains(finance, "Table 1")
        self.assertNotContains(finance, "Table 2")
        self.assertEqual(clients.status_code, 200)
        self.assertEqual(team.status_code, 200)
        self.assertContains(inventory, f'href="{reverse("serveur_dashboard")}"')
        self.assertContains(inventory, f'href="{reverse("serveur_inventory")}"')
        self.assertContains(inventory, f'href="{reverse("serveur_finance")}"')
        self.assertContains(inventory, f'href="{reverse("serveur_clients")}"')
        self.assertContains(inventory, f'href="{reverse("serveur_team")}"')
        self.assertContains(inventory, f'href="{reverse("serveur_tables")}"')

    def test_waiter_inventory_api_is_read_only_and_flag_protected(self):
        self.client.force_login(self.server)
        denied = self.client.get("/api/serveur/inventory/")
        self.assertEqual(denied.status_code, 403)

        self.grant_access("inventory")
        self.client.force_login(self.server)
        allowed = self.client.get("/api/serveur/inventory/")
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.data["bar"]["nom"], self.bar.nom)
        self.assertTrue(any(item["product_name"] == "Johnnie Walker" for item in allowed.data["items"]))

    def test_waiter_cannot_self_grant_owner_controlled_access_flags(self):
        client = APIClient()
        client.force_authenticate(self.server)

        response = client.patch(f"/api/serveur/profiles/{self.server_profile.id}/", {
            "inventory_access_granted": True,
            "tables_access_granted": True,
            "reports_access_granted": True,
        }, format="json")

        self.assertEqual(response.status_code, 200)
        self.server_profile.refresh_from_db()
        self.assertFalse(self.server_profile.inventory_access_granted)
        self.assertFalse(self.server_profile.tables_access_granted)
        self.assertFalse(self.server_profile.reports_access_granted)
        self.assertEqual(client.get("/api/serveur/inventory/").status_code, 403)

    def test_waiter_report_api_is_limited_to_own_orders(self):
        self.grant_access("reports")
        self.client.force_login(self.server)

        response = self.client.get("/api/serveur/reports/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["orders_count"], 1)
        self.assertEqual(response.data["summary"]["tables_touched"], 1)
        self.assertEqual(response.data["orders"][0]["table_nom"], "Table 1")


class ServeurLogoutTests(TestCase):
    def test_waiter_logout_clears_session_and_redirects_to_login(self):
        user = User.objects.create_user(username="logout-waiter", email="logout@example.com", password="pass")
        self.client.force_login(user)

        response = self.client.get(reverse("serveur_logout"))

        self.assertRedirects(response, reverse("login_html"))
        self.assertNotIn("_auth_user_id", self.client.session)


class ServeurTakeOrderTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="order-owner", email="order-owner@example.com", password="pass")
        self.server = User.objects.create_user(username="order-waiter", email="order-waiter@example.com", password="pass")
        self.bar = Bar.objects.create(nom="Order Bar", adresse="Kinshasa")
        self.table = Table.objects.create(bar=self.bar, nom="Table 1")
        self.category = Category.objects.create(nom="Bieres")
        self.product = MasterProduct.objects.create(nom="Primus", categorie=self.category, volume_cl=33)
        self.stock_item = StockItem.objects.create(
            bar=self.bar,
            produit=self.product,
            quantite_actuelle=24,
            prix_vente_unitaire=2.50,
            devise="USD",
        )
        PilotProfile.objects.filter(user=self.owner).update(
            role="PROPRIETAIRE",
            bar=self.bar,
            nom="Owner",
            prenom="Order",
        )
        PilotProfile.objects.filter(user=self.server).update(
            role="SERVEUR",
            bar=self.bar,
            nom="Waiter",
            prenom="Order",
        )
        self.server_profile = ServeurProfile.objects.create(
            user=self.server,
            nom="WAITER",
            prenom="Order",
            email=self.server.email,
            bar=self.bar,
            confirmation_status="CONFIRMED",
            actif=True,
        )
        Shift.objects.create(
            serveur=self.server_profile,
            bar=self.bar,
            start_time=timezone.now(),
            status="ACTIVE",
        )

    def test_waiter_dashboard_new_order_opens_popover(self):
        self.client.force_login(self.server)

        response = self.client.get(reverse("serveur_dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "openTakeOrderPopover()")
        self.assertContains(response, 'id="takeOrderPopover"')
        self.assertContains(response, reverse("serveur_take_order"))
        self.assertContains(response, "Primus")
        self.assertNotContains(response, f'href="{reverse("serveur_take_order")}"')

    def test_waiter_new_order_page_uses_waiter_route_for_direct_access(self):
        self.client.force_login(self.server)

        response = self.client.get(reverse("serveur_take_order"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("serveur_take_order"))
        self.assertContains(response, "Prendre une commande")
        self.assertContains(response, "Primus")

    def test_waiter_can_create_order_without_owner_route(self):
        self.client.force_login(self.server)

        response = self.client.post(reverse("serveur_take_order"), {
            "table_id": self.table.id,
            "items[]": [f"{self.stock_item.id}:2:BOUTEILLE"],
        })

        self.assertRedirects(response, reverse("serveur_dashboard"))
        order = Order.objects.get(bar=self.bar, table=self.table)
        self.assertEqual(order.serveur.user, self.server)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().quantite, 2)
        self.assertEqual(order.total_usd, self.stock_item.prix_vente_unitaire * 2)

    def test_waiter_glass_order_uses_inventory_glass_price(self):
        whisky_category = Category.objects.create(nom="Whiskies")
        whisky = MasterProduct.objects.create(nom="Johnnie Walker", categorie=whisky_category, volume_cl=75)
        whisky_stock = StockItem.objects.create(
            bar=self.bar,
            produit=whisky,
            quantite_actuelle=5,
            prix_vente_unitaire=Decimal("80.00"),
            prix_vente_verre=Decimal("8.50"),
            vente_au_verre=False,
            devise="USD",
        )
        self.client.force_login(self.server)

        response = self.client.post(reverse("serveur_take_order"), {
            "table_id": self.table.id,
            "items[]": [f"{whisky_stock.id}:3:VERRE"],
        })

        self.assertRedirects(response, reverse("serveur_dashboard"))
        order = Order.objects.get(bar=self.bar, table=self.table)
        item = order.items.get(product_item=whisky_stock)
        self.assertEqual(item.unite_vente, "VERRE")
        self.assertEqual(item.prix_unitaire, Decimal("8.50"))
        self.assertEqual(order.total_usd, Decimal("25.50"))

    def test_invalid_glass_order_does_not_create_line(self):
        self.client.force_login(self.server)

        response = self.client.post(reverse("serveur_take_order"), {
            "table_id": self.table.id,
            "items[]": [f"{self.stock_item.id}:1:VERRE"],
        })

        self.assertRedirects(response, reverse("serveur_dashboard"))
        self.assertFalse(Order.objects.filter(bar=self.bar, table=self.table).exists())

    def test_owner_glass_order_uses_same_inventory_pricing_helper(self):
        wine_category = Category.objects.create(nom="Vins")
        wine = MasterProduct.objects.create(nom="Merlot", categorie=wine_category, volume_cl=75)
        wine_stock = StockItem.objects.create(
            bar=self.bar,
            produit=wine,
            quantite_actuelle=8,
            prix_vente_unitaire=Decimal("30.00"),
            prix_vente_verre=Decimal("4.00"),
            vente_au_verre=True,
            devise="USD",
        )
        self.client.force_login(self.owner)

        response = self.client.post(reverse("take_order"), {
            "table_id": self.table.id,
            "items[]": [f"{wine_stock.id}:2:VERRE"],
        })

        self.assertRedirects(response, reverse("dashboard_html"))
        order = Order.objects.get(bar=self.bar, table=self.table)
        item = order.items.get(product_item=wine_stock)
        self.assertEqual(item.unite_vente, "VERRE")
        self.assertEqual(item.prix_unitaire, Decimal("4.00"))
        self.assertEqual(order.total_usd, Decimal("8.00"))

    def test_owner_dashboard_form_shows_inventory_glass_and_bottle_choices(self):
        wine_category = Category.objects.create(nom="Vins rouges")
        wine = MasterProduct.objects.create(nom="Cabernet", categorie=wine_category, volume_cl=75)
        StockItem.objects.create(
            bar=self.bar,
            produit=wine,
            quantite_actuelle=6,
            prix_vente_unitaire=Decimal("40.00"),
            prix_vente_verre=Decimal("6.00"),
            devise="USD",
        )
        self.client.force_login(self.owner)

        response = self.client.get(reverse("dashboard_html"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Cabernet")
        self.assertContains(response, "+ Bottle")
        self.assertContains(response, "+ Glass")

    def test_product_name_can_enable_glass_and_bottle_buttons(self):
        generic_category = Category.objects.create(nom="Premium")
        vodka = MasterProduct.objects.create(nom="Vodka Absolut", categorie=generic_category, volume_cl=75)
        StockItem.objects.create(
            bar=self.bar,
            produit=vodka,
            quantite_actuelle=10,
            prix_vente_unitaire=Decimal("45.00"),
            prix_vente_verre=Decimal("5.00"),
            vente_au_verre=False,
            devise="USD",
        )
        self.client.force_login(self.server)

        response = self.client.get(reverse("serveur_dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Vodka Absolut")
        self.assertContains(response, "+ Bottle")
        self.assertContains(response, "+ Glass")

    def test_waiter_dashboard_scopes_orders_personally_but_occupancy_globally(self):
        other_user = User.objects.create_user(username="other-active", email="other-active@example.com", password="pass")
        PilotProfile.objects.filter(user=other_user).update(role="SERVEUR", bar=self.bar, nom="Other", prenom="Active")
        other_profile = PilotProfile.objects.get(user=other_user)
        other_table = Table.objects.create(bar=self.bar, nom="Table 2")
        Order.objects.create(bar=self.bar, table=self.table, serveur=PilotProfile.objects.get(user=self.server), statut="PENDING")
        Order.objects.create(bar=self.bar, table=other_table, serveur=other_profile, statut="PENDING")

        self.client.force_login(self.server)
        response = self.client.get(reverse("serveur_dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Vos commandes uniquement")
        self.assertContains(response, "Table 1")
        self.assertEqual(response.context["active_orders"], 1)
        self.assertEqual(response.context["tables_actives"], 2)
        self.assertEqual(response.context["tables_total"], 2)
        self.assertEqual(list(response.context["recent_orders"])[0].table, self.table)
        self.assertContains(response, "/ 2")

    def test_waiter_can_report_multiple_beverage_losses(self):
        second_product = MasterProduct.objects.create(nom="Skol", categorie=self.category, volume_cl=33)
        second_stock = StockItem.objects.create(
            bar=self.bar,
            produit=second_product,
            quantite_actuelle=12,
            prix_vente_unitaire=Decimal("2.00"),
            devise="USD",
        )
        self.client.force_login(self.server)

        response = self.client.post(reverse("serveur_record_loss"), {
            "item_id[]": [str(self.stock_item.id), str(second_stock.id)],
            "quantite[]": ["2", "3"],
            "raison[]": ["CASSE", "VOL"],
            "commentaire[]": ["Broken bottle", "Missing crate"],
        })

        self.assertRedirects(response, reverse("serveur_dashboard"))
        self.stock_item.refresh_from_db()
        second_stock.refresh_from_db()
        self.assertEqual(self.stock_item.quantite_actuelle, Decimal("22.000"))
        self.assertEqual(second_stock.quantite_actuelle, Decimal("9.000"))
        self.assertEqual(Perte.objects.filter(bar=self.bar).count(), 2)

    def test_waiter_cannot_access_owner_routes(self):
        self.client.force_login(self.server)

        response = self.client.get(reverse("dashboard_html"))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("serveur_dashboard"))

    def test_owner_cannot_access_waiter_routes(self):
        self.client.force_login(self.owner)

        response = self.client.get(reverse("serveur_take_order"))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("dashboard_html"))

    def test_cross_role_api_routes_are_forbidden(self):
        self.client.force_login(self.server)

        response = self.client.get("/api/proprietaire/api/live-orders/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Access denied for this role.")
