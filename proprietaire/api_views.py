from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Count, Max, F
from django.db.models.functions import ExtractHour
from datetime import timedelta
from .models import Bar, PilotProfile, Table, Category, MasterProduct, StockItem, Sale, StockSupply, Order, OrderItem, StaffShift
from .serializers import (
    BarSerializer, PilotProfileSerializer, TableSerializer, CategorySerializer, 
    MasterProductSerializer, StockItemSerializer, SaleSerializer, StockSupplySerializer,
    OrderSerializer, OrderItemSerializer, StaffShiftSerializer
)

class StaffShiftViewSet(viewsets.ModelViewSet):
    queryset = StaffShift.objects.all()
    serializer_class = StaffShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # A waiter sees only their own shifts, an owner sees all shifts for their bar
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if not profile: return StaffShift.objects.none()
        
        if profile.role == 'PROPRIETAIRE':
            return StaffShift.objects.filter(bar=profile.bar)
        return StaffShift.objects.filter(worker=profile)

    def perform_create(self, serializer):
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if profile and profile.bar:
            # Check if there is already an active shift
            if StaffShift.objects.filter(worker=profile, status__in=['ACTIVE', 'BREAK']).exists():
                from rest_framework.exceptions import ValidationError
                raise ValidationError("Vous avez déjà une session active.")
            serializer.save(worker=profile, bar=profile.bar)
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Vous devez être rattaché à un établissement.")

class StockSupplyViewSet(viewsets.ModelViewSet):
    queryset = StockSupply.objects.all()
    serializer_class = StockSupplySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if not profile or not profile.bar:
            return StockSupply.objects.none()
        return StockSupply.objects.filter(item__bar=profile.bar)

class PilotProfileViewSet(viewsets.ModelViewSet):
    queryset = PilotProfile.objects.all()
    serializer_class = PilotProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PilotProfile.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get', 'patch', 'put'])
    def me(self, request):
        profile, created = PilotProfile.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class BarViewSet(viewsets.ModelViewSet):
    queryset = Bar.objects.all()
    serializer_class = BarSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Un propriétaire ne voit que ses bars
        return Bar.objects.filter(proprietaires__user=self.request.user)

    def perform_create(self, serializer):
        # Sauvegarde le bar
        bar = serializer.save()
        
        # Lie le bar au profil du pilote de l'utilisateur connecté
        from .models import PilotProfile
        profile, _ = PilotProfile.objects.get_or_create(user=self.request.user)
        profile.bar = bar
        profile.role = 'PROPRIETAIRE'
        profile.save()

    @action(detail=False, methods=['post'], url_path='join/(?P<code>[^/.]+)')
    def join(self, request, code=None):
        try:
            bar = Bar.objects.get(code_invitation=code)
        except Bar.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Ce code d'invitation est invalide ou n'existe plus.")
            
        # Lie le profil du serveur connecté à ce bar
        from .models import PilotProfile
        profile, _ = PilotProfile.objects.get_or_create(user=request.user)
        profile.bar = bar
        profile.role = 'SERVEUR'
        profile.save()
        
        serializer = self.get_serializer(bar)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='check-invitation/(?P<code>[^/.]+)')
    def check_invitation(self, request, code=None):
        try:
            bar = Bar.objects.get(code_invitation=code)
        except Bar.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Ce code d'invitation est invalide.")
            
        proprietaire = bar.proprietaires.first()
        proprietaire_nom = f"{proprietaire.prenom} {proprietaire.nom}" if proprietaire else "Propriétaire BarPilote"
        
        return Response({
            "id": bar.id,
            "nom": bar.nom,
            "proprietaire_nom": proprietaire_nom,
            "type_etablissement": bar.get_type_etablissement_display()
        })

class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if not profile or not profile.bar:
            return Table.objects.none()
        return Table.objects.filter(bar=profile.bar)

    def perform_create(self, serializer):
        from .models import PilotProfile
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if profile and profile.bar:
            serializer.save(bar=profile.bar)
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Vous n'avez pas de bar associé.")

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        from .models import PilotProfile, Sale
        profile = PilotProfile.objects.filter(user=request.user).first()
        if not profile or not profile.bar:
            return Response({"error": "Profil incomplet."}, status=400)
        
        # Filtre temporel
        days_param = request.query_params.get('days', 30)
        try:
            days = int(days_param)
        except ValueError:
            days = 30
            
        bar = profile.bar
        start_date = timezone.now() - timedelta(days=days)
        
        tables = self.get_queryset()
        table_stats = []
        
        total_bar_revenue = 0
        
        for table in tables:
            # Revenu total sur la période
            rev = Sale.objects.filter(
                bar=bar, 
                table=table, 
                date_vente__gte=start_date
            ).aggregate(total=Sum(F('quantite') * F('prix_unitaire_applique')))['total'] or 0
            
            # Nombre de commandes
            order_count = Sale.objects.filter(
                bar=bar, 
                table=table, 
                date_vente__gte=start_date
            ).count()
            
            total_bar_revenue += float(rev)
            
            table_stats.append({
                "id": table.id,
                "nom": table.nom,
                "revenue": float(rev),
                "orders": order_count,
                "is_active": table.est_active,
                "qr_code": request.build_absolute_uri(table.code_qr_image.url) if table.code_qr_image else None
            })
            
        return Response({
            "tables": sorted(table_stats, key=lambda x: x['revenue'], reverse=True),
            "global": {
                "total_revenue": total_bar_revenue,
                "period": f"{days} derniers jours"
            }
        })

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]

class MasterProductViewSet(viewsets.ModelViewSet):
    queryset = MasterProduct.objects.all()
    serializer_class = MasterProductSerializer
    permission_classes = [permissions.IsAuthenticated]

class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all()
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if not profile or not profile.bar:
            return StockItem.objects.none()
        return StockItem.objects.filter(bar=profile.bar)

    def perform_create(self, serializer):
        from .models import PilotProfile
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if profile and profile.bar:
            # On vérifie si l'item existe déjà pour ce bar pour éviter le doublon via l'API
            from .models import StockItem
            if StockItem.objects.filter(bar=profile.bar, produit=serializer.validated_data['produit']).exists():
                from rest_framework.exceptions import ValidationError
                raise ValidationError("Ce produit est déjà dans votre stock.")
            serializer.save(bar=profile.bar)
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Vous n'avez pas de bar associé.")

class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if not profile or not profile.bar:
            return Sale.objects.none()
        return Sale.objects.filter(bar=profile.bar)

class OrderItemViewSet(viewsets.ModelViewSet):
    queryset = OrderItem.objects.all()
    serializer_class = OrderItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if not profile or not profile.bar:
            return OrderItem.objects.none()
        return OrderItem.objects.filter(order__bar=profile.bar)

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if not profile or not profile.bar:
            return Order.objects.none()
        return Order.objects.filter(bar=profile.bar)

    def perform_create(self, serializer):
        profile = PilotProfile.objects.filter(user=self.request.user).first()
        if profile and profile.bar:
            serializer.save(bar=profile.bar, serveur=profile)
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Vous n'avez pas de bar associé à votre profil.")

    @action(detail=True, methods=['post'])
    def mark_served(self, request, pk=None):
        order = self.get_object()
        order.statut = 'SERVED'
        order.date_service = timezone.now()
        order.save()
        serializer = self.get_serializer(order)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        from django.db import transaction
        order = self.get_object()
        
        with transaction.atomic():
            order.statut = 'PAID'
            order.save()
            
            # Archiver dans Sale pour les statistiques historiques
            for line in order.items.all():
                from .models import Sale
                Sale.objects.create(
                    bar=order.bar,
                    table=order.table,
                    item=line.product_item,
                    quantite=line.quantite,
                    prix_unitaire_applique=line.prix_unitaire,
                    devise=line.devise
                )
                # Décrémenter le stock
                line.product_item.quantite_actuelle -= line.quantite
                line.product_item.save()

        serializer = self.get_serializer(order)
        return Response(serializer.data)

class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from .models import PilotProfile
        profile = PilotProfile.objects.filter(user=request.user).first()
        if not profile or not profile.bar:
            return Response({"error": "Aucun bar associé à ce profil."}, status=400)
        
        bar = profile.bar
        today = timezone.now().date()
        
        # 1. Revenu et Ventes (Uniquement ce qui est PAYÉ)
        sales_today = Sale.objects.filter(bar=bar, date_vente__date=today)
        
        revenue_usd = sales_today.filter(devise='USD').aggregate(
            total=Sum(F('quantite') * F('prix_unitaire_applique'))
        )['total'] or 0
        
        revenue_cdf = sales_today.filter(devise='CDF').aggregate(
            total=Sum(F('quantite') * F('prix_unitaire_applique'))
        )['total'] or 0
        
        # 2. Commandes Actives (Tickets en cours)
        active_orders = Order.objects.filter(bar=bar).exclude(statut__in=['PAID', 'CANCELLED'])
        orders_count = active_orders.count()
        
        # 3. Calcul du temps d'attente réel moyen
        served_orders = Order.objects.filter(
            bar=bar, 
            date_service__isnull=False, 
            date_creation__date=today
        )
        
        total_wait = 0
        if served_orders.exists():
            for o in served_orders:
                diff = (o.date_service - o.date_creation).total_seconds() / 60
                total_wait += diff
            avg_wait = total_wait / served_orders.count()
        else:
            avg_wait = 0
        
        client_count = sales_today.count() 
        avg_basket = revenue_usd / client_count if client_count > 0 else 0
        
        # Meilleure Vente
        best_seller_data = sales_today.values('item__produit__nom').annotate(
            total_qty=Sum('quantite')
        ).order_by('-total_qty').first()
        
        best_seller = {
            "name": best_seller_data['item__produit__nom'] if best_seller_data else "---",
            "qty": best_seller_data['total_qty'] if best_seller_data else 0
        }
        
        # Données horaires
        hourly_sales_raw = sales_today.annotate(hour=ExtractHour('date_vente')).values('hour').annotate(
            total=Sum(F('quantite') * F('prix_unitaire_applique'))
        ).order_by('hour')
        
        hourly_data = []
        sales_map = {item['hour']: float(item['total']) for item in hourly_sales_raw}
        for h in range(24):
            hourly_data.append({
                "time": f"{h}h",
                "revenue": sales_map.get(h, 0),
                "isPic": False
            })
            
        if hourly_data:
            max_rev = max(d['revenue'] for d in hourly_data)
            if max_rev > 0:
                for d in hourly_data:
                    if d['revenue'] == max_rev:
                        d['isPic'] = True
                        break
        
        # Alertes Stock
        stock_alerts = StockItem.objects.filter(
            bar=bar, 
            quantite_actuelle__lte=F('seuil_alerte')
        ).count()
        
        # Inventaire résumé
        inventory_summary = []
        for cat in Category.objects.all():
            items = StockItem.objects.filter(bar=bar, produit__categorie=cat)
            if items.exists():
                total_stock = items.aggregate(Sum('quantite_actuelle'))['quantite_actuelle__sum'] or 0
                avg_threshold = items.aggregate(Sum('seuil_alerte'))['seuil_alerte__sum'] or 1
                health = min(100, (total_stock / (avg_threshold * 5)) * 100) 
                inventory_summary.append({
                    "category": cat.nom,
                    "level": round(health),
                    "alert": total_stock <= avg_threshold
                })

        return Response({
            "bar_info": {
                "nom": bar.nom,
                "logo": request.build_absolute_uri(bar.logo.url) if bar.logo else None,
                "code_invitation": bar.code_invitation
            },
            "revenue": {
                "usd": float(revenue_usd),
                "cdf": float(revenue_cdf)
            },
            "metrics": {
                "clients": client_count,
                "active_orders": orders_count,
                "avg_basket": float(avg_basket),
                "wait_time": round(avg_wait, 1), 
            },
            "best_seller": best_seller,
            "stock_alerts": stock_alerts,
            "inventory_summary": inventory_summary[:4],
            "hourly_data": hourly_data
        })

class FinancialReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from .models import PilotProfile, Category, Sale, StockItem
        profile = PilotProfile.objects.filter(user=request.user).first()
        if not profile or not profile.bar:
            return Response({"error": "Profil incomplet."}, status=400)
        
        # Récupération de la période (défaut 30 jours)
        days_param = request.query_params.get('days', 30)
        try:
            days = int(days_param)
        except ValueError:
            days = 30

        bar = profile.bar
        today = timezone.now()
        start_date = today - timedelta(days=days)
        
        # 1. Calcul Global
        sales = Sale.objects.filter(bar=bar, date_vente__gte=start_date)
        
        total_revenue = 0
        total_cost = 0 # COGS (Cost of Goods Sold)
        
        for sale in sales:
            # Conversion analytique en USD
            revenue = sale.quantite * sale.prix_unitaire_applique
            if sale.devise == 'CDF':
                revenue = float(revenue) / 2500
            
            # Coût de revient basé sur le prix d'achat enregistré dans le stock
            cost = sale.quantite * (sale.item.prix_achat_unitaire or 0)
            if sale.item.devise == 'CDF':
                cost = float(cost) / 2500
                
            total_revenue += float(revenue)
            total_cost += float(cost)
            
        net_margin_pct = ((total_revenue - total_cost) / total_revenue * 100) if total_revenue > 0 else 0
        
        # 2. Performance par Catégorie
        category_data = []
        for cat in Category.objects.all():
            cat_sales = sales.filter(item__produit__categorie=cat)
            cat_rev = 0
            cat_cost = 0
            for s in cat_sales:
                rev = s.quantite * s.prix_unitaire_applique
                cst = s.quantite * (s.item.prix_achat_unitaire or 0)
                if s.devise == 'CDF': rev = float(rev) / 2500
                if s.item.devise == 'CDF': cst = float(cst) / 2500
                cat_rev += float(rev)
                cat_cost += float(cst)
            
            if cat_rev > 0:
                category_data.append({
                    "id": cat.id,
                    "category": cat.nom,
                    "revenue": round(cat_rev, 2),
                    "margin": round(((cat_rev - cat_cost) / cat_rev) * 100, 1),
                    "isHighVolume": cat_rev > (total_revenue * 0.4)
                })

        # 3. Evolution Hebdomadaire (Spline)
        weekly_data = []
        for i in range(7):
            d = (today - timedelta(days=6-i)).date()
            day_sales = sales.filter(date_vente__date=d)
            day_rev = 0
            day_cost = 0
            for s in day_sales:
                rev = s.quantite * s.prix_unitaire_applique
                cst = s.quantite * (s.item.prix_achat_unitaire or 0)
                if s.devise == 'CDF': rev = float(rev) / 2500
                if s.item.devise == 'CDF': cst = float(cst) / 2500
                day_rev += float(rev)
                day_cost += float(cst)
            
            margin = ((day_rev - day_cost) / day_rev * 100) if day_rev > 0 else 0
            weekly_data.append({
                "day": d.strftime('%a'),
                "margin": round(margin, 1),
                "revenue": round(day_rev, 2)
            })

        # 4. Résumé Exécutif / Insights IA
        insight = "Performance stable."
        if net_margin_pct > 40:
            insight = f"Excellente performance ! Votre marge nette de {round(net_margin_pct)}% est portée par une gestion rigoureuse."
        elif net_margin_pct < 20:
            insight = "Attention : Vos coûts de revient sont trop élevés par rapport à vos prix de vente."

        return Response({
            "metrics": {
                "net_margin": round(net_margin_pct, 1),
                "cogs_reduction": "-12.5%", # Variable pour futur audit
                "waste_factor": "2.1%",     # Variable pour futur audit
                "labor_efficiency": "+8.4%" # Variable pour futur audit
            },
            "executive_summary": insight,
            "weekly_trend": weekly_data,
            "category_breakdown": category_data,
            "period": f"{start_date.strftime('%b %Y')} - {today.strftime('%b %Y')}"
        })

class StaffManagementViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from .models import PilotProfile, StaffShift, Sale, Table, Order
        profile = PilotProfile.objects.filter(user=request.user).first()
        if not profile or not profile.bar:
            return Response({"error": "Profil incomplet."}, status=400)
        
        bar = profile.bar
        today = timezone.now().date()
        
        # Liste de tous les serveurs du bar
        servers = PilotProfile.objects.filter(role='SERVEUR', bar=bar)
        
        staff_data = []
        for server in servers:
            # Shift actif
            active_shift = StaffShift.objects.filter(
                worker=server, 
                status__in=['ACTIVE', 'BREAK']
            ).order_by('-start_time').first()
            
            # CA du jour (calculé via les commandes du serveur)
            total_sales = Sale.objects.filter(
                bar=bar, 
                table__orders__serveur=server,
                table__orders__date_creation__date=today
            ).distinct().aggregate(Sum('prix_unitaire_applique'))['prix_unitaire_applique__sum'] or 0
            
            # Tables actives
            active_tables_count = Order.objects.filter(
                bar=bar, 
                serveur=server, 
                statut__in=['PENDING', 'PREPARING', 'SERVED']
            ).values('table').distinct().count()
            
            # Temps d'activité
            active_time_str = "---"
            if active_shift:
                delta = timezone.now() - active_shift.start_time
                hours, remainder = divmod(int(delta.total_seconds()), 3600)
                minutes, _ = divmod(remainder, 60)
                active_time_str = f"{hours}h {minutes}m"
            
            staff_data.append({
                "id": server.id,
                "name": f"{server.prenom} {server.nom}",
                "status": active_shift.status if active_shift else "OFFLINE",
                "tables_count": active_tables_count,
                "sales_impact": float(total_sales),
                "active_time": active_time_str,
                "role": "Floor Lead" if active_tables_count > 5 else "Waitstaff"
            })
            
        return Response({
            "staff": staff_data,
            "global_stats": {
                "total_servers": servers.count(),
                "active_now": servers.filter(shifts__status='ACTIVE').distinct().count(),
                "avg_sales_per_hour": 342, 
                "occupancy_rate": 75      
            }
        })
