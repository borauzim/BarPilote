from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.db.models import Avg, Count, Q, Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from decimal import Decimal, InvalidOperation
from django.views import View

from client.models import ClientServiceRating
from proprietaire.adsense_reporting import fetch_report
from proprietaire.models import AdsenseRevenue, AdministrationExpense, Bar, Order, PilotProfile, SubscriptionPayment, Table


class SuperuserRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    login_url = "/auth/login/"
    raise_exception = True

    def test_func(self):
        return bool(self.request.user.is_authenticated and self.request.user.is_superuser)


class AdministrationDashboardView(SuperuserRequiredMixin, View):
    template_name = "administration/dashboard.html"

    def get(self, request):
        now = timezone.now()
        query = request.GET.get("q", "").strip()
        bar_type = request.GET.get("type", "").strip()
        subscription = request.GET.get("subscription", "").strip()
        bars = Bar.objects.annotate(
            tables_count=Count("tables", distinct=True),
            active_tables_count=Count("tables", filter=Q(tables__est_active=True), distinct=True),
            owners_count=Count("owners", distinct=True),
            servers_count=Count("proprietaires", filter=Q(proprietaires__role="SERVEUR"), distinct=True),
            orders_count=Count("orders", distinct=True),
            active_orders_count=Count("orders", filter=Q(orders__statut__in=["PENDING", "ACCEPTEE", "PREPARING", "SERVED"]), distinct=True),
        ).order_by("-date_creation")
        if query:
            bars = bars.filter(Q(nom__icontains=query) | Q(adresse__icontains=query) | Q(owners__user__email__icontains=query)).distinct()
        if bar_type:
            bars = bars.filter(type_etablissement=bar_type)
        if subscription == "active":
            bars = bars.filter(abonnement_expire_le__gt=now)
        elif subscription == "expired":
            bars = bars.filter(abonnement_expire_le__lte=now)
        elif subscription == "unset":
            bars = bars.filter(abonnement_expire_le__isnull=True)
        totals = Order.objects.exclude(statut="CANCELLED").aggregate(
            usd=Sum("total_usd"), cdf=Sum("total_cdf"),
        )
        totals = {key: value or 0 for key, value in totals.items()}
        subscription_totals = SubscriptionPayment.objects.filter(status="PAID").aggregate(usd=Sum("amount_usd"), count=Count("id"))
        pending_subscription_totals = SubscriptionPayment.objects.filter(status="PENDING").aggregate(usd=Sum("amount_usd"), count=Count("id"))
        expense_totals = AdministrationExpense.objects.aggregate(usd=Sum("amount_usd"), count=Count("id"))
        try:
            adsense_report = fetch_report()
        except Exception:
            adsense_report = {"configured": True, "error": "Impossible de joindre AdSense pour le moment."}
        adsense_totals = AdsenseRevenue.objects.aggregate(usd=Sum("amount_usd"), count=Count("id"))
        adsense_revenues = AdsenseRevenue.objects.select_related("created_by").order_by("-period", "-created_at")[:20]
        expenses = AdministrationExpense.objects.select_related("created_by").order_by("-spent_at", "-created_at")[:20]
        subscription_payments = SubscriptionPayment.objects.select_related("bar").order_by("-created_at")[:20]
        page = Paginator(bars, 12).get_page(request.GET.get("page"))
        return render(request, self.template_name, {
            "page": page, "bars": page.object_list, "query": query,
            "selected_type": bar_type, "selected_subscription": subscription,
            "bar_types": Bar.BAR_TYPES, "bars_total": Bar.objects.count(),
            "active_subscriptions": Bar.objects.filter(abonnement_expire_le__gt=now).count(),
            "owners_total": PilotProfile.objects.filter(role="PROPRIETAIRE").count(),
            "servers_total": PilotProfile.objects.filter(role="SERVEUR").count(),
            "tables_total": Table.objects.count(),
            "active_orders": Order.objects.filter(statut__in=["PENDING", "ACCEPTEE", "PREPARING", "SERVED"]).count(),
            "users_total": User.objects.count(), "revenue_usd": totals["usd"],
            "revenue_cdf": totals["cdf"],
            "subscription_revenue_usd": subscription_totals["usd"] or 0,
            "subscription_paid_count": subscription_totals["count"],
            "subscription_pending_usd": pending_subscription_totals["usd"] or 0,
            "subscription_pending_count": pending_subscription_totals["count"],
            "subscription_payments": subscription_payments,
            "expense_total_usd": expense_totals["usd"] or 0,
            "expense_count": expense_totals["count"],
            "expenses": expenses,
            "adsense_total_usd": adsense_totals["usd"] or 0,
            "adsense_count": adsense_totals["count"],
            "adsense_revenues": adsense_revenues,
            "adsense_report": adsense_report,
            "recent_orders": Order.objects.select_related("bar", "table", "serveur").order_by("-date_creation")[:8],
            "now": now,
        })


class AdministrationAdsenseRevenueCreateView(SuperuserRequiredMixin, View):
    template_name = "administration/adsense_form.html"

    def get(self, request):
        return render(request, self.template_name, {"today": timezone.localdate()})

    def post(self, request):
        raw_period = (request.POST.get("period") or "").strip()
        raw_amount = (request.POST.get("amount_usd") or "").strip().replace(",", ".")
        notes = (request.POST.get("notes") or "").strip()
        try:
            from datetime import date
            period = date.fromisoformat(raw_period + "-01") if len(raw_period) == 7 else date.fromisoformat(raw_period)
        except (ValueError, TypeError):
            period = None
        try:
            amount = Decimal(raw_amount)
        except (InvalidOperation, ValueError):
            amount = None
        if period is None:
            error = "Choisissez une période valide."
        elif amount is None or amount < 0 or amount > Decimal("100000000"):
            error = "Entrez un montant compris entre 0 et 100 000 000 USD."
        elif AdsenseRevenue.objects.filter(period=period).exists():
            error = "Cette période AdSense existe déjà. Modifiez-la depuis l’administration technique."
        else:
            error = None
        if error:
            return render(request, self.template_name, {"today": raw_period or timezone.localdate(), "form_error": error, "form_data": request.POST}, status=400)
        AdsenseRevenue.objects.create(period=period, amount_usd=amount, notes=notes, created_by=request.user)
        return redirect("administration_dashboard")


class AdministrationExpenseCreateView(SuperuserRequiredMixin, View):
    template_name = "administration/expense_form.html"

    def get(self, request):
        return render(request, self.template_name, {"categories": AdministrationExpense.CATEGORY_CHOICES, "today": timezone.localdate()})

    def post(self, request):
        title = (request.POST.get("title") or "").strip()
        category = (request.POST.get("category") or "OTHER").strip()
        raw_amount = (request.POST.get("amount_usd") or "").strip().replace(",", ".")
        spent_at = (request.POST.get("spent_at") or "").strip()
        notes = (request.POST.get("notes") or "").strip()
        try:
            amount = Decimal(raw_amount)
        except (InvalidOperation, ValueError):
            amount = None
        valid_categories = {value for value, _ in AdministrationExpense.CATEGORY_CHOICES}
        error = None
        if not title or len(title) > 180:
            error = "Indique un titre (180 caractères maximum)."
        elif amount is None or amount <= 0 or amount > Decimal("100000000"):
            error = "Entrez un montant supérieur à 0 et inférieur à 100 000 000 USD."
        elif category not in valid_categories:
            error = "Choisissez une catégorie valide."
        if error:
            return render(request, self.template_name, {"categories": AdministrationExpense.CATEGORY_CHOICES, "today": spent_at or timezone.localdate(), "form_error": error, "form_data": request.POST}, status=400)
        AdministrationExpense.objects.create(title=title, category=category, amount_usd=amount, spent_at=spent_at or timezone.localdate(), notes=notes, created_by=request.user)
        return redirect("administration_dashboard")


class AdministrationEstablishmentDetailView(SuperuserRequiredMixin, View):
    template_name = "administration/establishment_detail.html"

    def post(self, request, bar_id):
        bar = get_object_or_404(Bar, id=bar_id)
        raw_price = (request.POST.get("price_per_table_usd") or "").strip().replace(",", ".")
        try:
            price = Decimal(raw_price)
        except (InvalidOperation, ValueError):
            price = None
        if price is None or price < 0 or price > Decimal("100000"):
            return render(request, self.template_name, {"bar": bar, "price_error": "Entrez un prix compris entre 0 et 100 000 USD."}, status=400)
        bar.prix_mensuel_par_table_usd = price
        bar.save(update_fields=["prix_mensuel_par_table_usd"])
        return redirect("administration_establishment_detail", bar_id=bar.id)

    def get(self, request, bar_id):
        bar = get_object_or_404(Bar, id=bar_id)
        orders = Order.objects.filter(bar=bar)
        completed_orders = orders.exclude(statut="CANCELLED")
        totals = completed_orders.aggregate(usd=Sum("total_usd"), cdf=Sum("total_cdf"))
        served_orders = list(orders.filter(date_service__isnull=False).only("date_creation", "date_service"))
        service_minutes = [
            max(0, (order.date_service - order.date_creation).total_seconds() / 60)
            for order in served_orders
        ]
        ratings = ClientServiceRating.objects.filter(order__bar=bar).aggregate(
            server=Avg("server_score"), bar=Avg("bar_score"), count=Count("id"),
        )
        owners = (PilotProfile.objects.filter(Q(owned_bars=bar) | Q(bar=bar, role="PROPRIETAIRE"))
                  .select_related("user").distinct().order_by("prenom", "nom"))
        servers = (PilotProfile.objects.filter(bar=bar, role="SERVEUR")
                   .select_related("user").annotate(
                       orders_count=Count("order", distinct=True),
                       average_score=Avg("client_server_ratings__server_score"),
                   ).order_by("prenom", "nom"))
        tables = bar.tables.annotate(
            orders_count=Count("orders", distinct=True),
            active_orders_count=Count("orders", filter=Q(orders__statut__in=["PENDING", "ACCEPTEE", "PREPARING", "SERVED"]), distinct=True),
        ).select_related("assigned_server").order_by("nom")
        status_counts = {item["statut"]: item["count"] for item in orders.values("statut").annotate(count=Count("id"))}
        return render(request, self.template_name, {
            "bar": bar, "owners": owners, "servers": servers, "tables": tables,
            "orders_total": orders.count(),
            "active_orders": orders.filter(statut__in=["PENDING", "ACCEPTEE", "PREPARING", "SERVED"]).count(),
            "paid_orders": status_counts.get("PAID", 0), "cancelled_orders": status_counts.get("CANCELLED", 0),
            "revenue_usd": totals["usd"] or 0, "revenue_cdf": totals["cdf"] or 0,
            "average_service_minutes": sum(service_minutes) / len(service_minutes) if service_minutes else 0,
            "average_server_score": ratings["server"] or 0, "average_bar_score": ratings["bar"] or 0,
            "ratings_count": ratings["count"],
            "recent_orders": orders.select_related("table", "serveur").order_by("-date_creation")[:20],
            "now": timezone.now(),
        })
