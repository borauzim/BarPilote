from django.views.generic import TemplateView, View
from django.contrib import messages
import json
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
import os
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Sum, Q, Count, F
from django.utils import timezone
from datetime import timedelta
from django.http import HttpResponse, FileResponse, JsonResponse
from decimal import Decimal
from django.conf import settings
import qrcode
import io
import zipfile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
import uuid
from .models import PilotProfile, Order, Table, Bar, BarAdvisorSettings, StockItem, OrderItem, Category, Facture, Client, Notification, grant_trial_if_eligible, record_owner_audit
from .order_services import take_order_for_profile
from .notifications import ensure_daily_debt_reminders, notify_bar_owners, notify_bar_servers, notify_debt_created, notify_order_created, notify_order_status, notify_user
from .advisor import generate_advisor_response


def _expects_json(request):
    accept = request.headers.get('Accept', '')
    return request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in accept


def _live_payload(request, payload, status=200):
    if _expects_json(request):
        return JsonResponse(payload, status=status)
    return None




class AdvisorAPIView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = PilotProfile.objects.filter(user=request.user).select_related('bar').first()
        if not profile or not profile.bar:
            return JsonResponse({'error': 'Profil incomplet.'}, status=400)

        question = request.POST.get('question', '').strip()
        if not question:
            return JsonResponse({'error': 'Question vide.'}, status=400)

        history = []
        raw_history = request.POST.get('history', '[]')
        try:
            parsed_history = json.loads(raw_history)
            if isinstance(parsed_history, list):
                history = parsed_history
        except json.JSONDecodeError:
            history = []

        return JsonResponse(generate_advisor_response(profile, question, history))

class NotificationsAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        ensure_daily_debt_reminders(request.user)
        qs = Notification.objects.filter(recipient=request.user).select_related('bar', 'actor').order_by('-created_at')
        unread_count = qs.filter(read_at__isnull=True).count()
        items = []
        for notification in qs[:30]:
            actor_name = ''
            if notification.actor:
                actor_name = notification.actor.get_full_name() or notification.actor.get_username()
            items.append({
                'id': str(notification.id),
                'category': notification.category,
                'title': notification.title,
                'message': notification.message,
                'url': notification.url,
                'is_read': notification.is_read,
                'actor': actor_name,
                'created_at': timezone.localtime(notification.created_at).strftime('%d/%m %H:%M'),
            })
        return JsonResponse({'unread_count': unread_count, 'notifications': items})

    def post(self, request, *args, **kwargs):
        action = request.POST.get('action')
        if action == 'mark_all_read':
            Notification.objects.filter(recipient=request.user, read_at__isnull=True).update(read_at=timezone.now())
            return JsonResponse({'success': True})

        notification_id = request.POST.get('notification_id')
        if notification_id:
            Notification.objects.filter(id=notification_id, recipient=request.user, read_at__isnull=True).update(read_at=timezone.now())
            return JsonResponse({'success': True})

        return JsonResponse({'error': 'Action invalide.'}, status=400)

class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/dashboard.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        
        try:
            profile = PilotProfile.objects.get(user=user)
            bar = profile.bar
            context['profile'] = profile
            context['bar'] = bar
            
            if bar:
                today = timezone.now().date()
                
                # Revenue (PAID orders today)
                revenue_data = Order.objects.filter(
                    bar=bar, 
                    statut='PAID',
                    date_creation__date=today
                ).aggregate(
                    total_usd=Sum('total_usd'),
                    total_cdf=Sum('total_cdf')
                )
                context['total_revenue_usd'] = revenue_data['total_usd'] or 0
                context['total_revenue_cdf'] = revenue_data['total_cdf'] or 0
                
                # Yesterday's Revenue & Dynamic Growth calculation
                from datetime import timedelta
                from decimal import Decimal
                yesterday = today - timedelta(days=1)
                
                revenue_yesterday = Order.objects.filter(
                    bar=bar, 
                    statut='PAID',
                    date_creation__date=yesterday
                ).aggregate(
                    total_usd=Sum('total_usd'),
                    total_cdf=Sum('total_cdf')
                )
                total_yesterday_usd = Decimal(revenue_yesterday['total_usd'] or 0)
                total_yesterday_cdf = Decimal(revenue_yesterday['total_cdf'] or 0)
                
                # Conversion to base USD to compute real growth
                rate = Decimal(bar.taux_change_usd_to_cdf or 2800)
                today_total_usd = Decimal(context['total_revenue_usd']) + (Decimal(context['total_revenue_cdf']) / rate)
                yesterday_total_usd = total_yesterday_usd + (total_yesterday_cdf / rate)
                
                if yesterday_total_usd > 0:
                    growth = ((today_total_usd - yesterday_total_usd) / yesterday_total_usd) * 100
                elif today_total_usd > 0:
                    growth = 100.0
                else:
                    growth = 0.0
                context['revenue_growth_percent'] = float(growth)
                
                # Last paid order details for dynamic cashing timer
                last_paid_order = Order.objects.filter(
                    bar=bar,
                    statut='PAID'
                ).order_by('-date_maj').first()
                
                if last_paid_order:
                    context['last_paid_timestamp'] = int(last_paid_order.date_maj.timestamp())
                    diff = timezone.now() - last_paid_order.date_maj
                    diff_seconds = int(diff.total_seconds())
                    if diff_seconds < 60:
                        context['last_paid_time_str'] = "à l'instant"
                    elif diff_seconds < 3600:
                        context['last_paid_time_str'] = f"il y a {diff_seconds // 60} min"
                    else:
                        context['last_paid_time_str'] = f"il y a {diff_seconds // 3600} h"
                else:
                    context['last_paid_timestamp'] = ""
                    context['last_paid_time_str'] = "aucun aujourd'hui"
                
                # Active Tables
                active_tables_ids = Order.objects.filter(
                    bar=bar, 
                    statut__in=['PENDING', 'ACCEPTEE', 'PREPARING']
                ).values_list('table_id', flat=True).distinct()
                
                context['tables_actives'] = active_tables_ids.count()
                total_tables = Table.objects.filter(bar=bar).count()
                context['tables_capacity_percent'] = int((context['tables_actives'] / total_tables) * 100) if total_tables > 0 else 0
                
                # Orders in flight
                context['active_orders'] = Order.objects.filter(
                    bar=bar, 
                    statut__in=['PENDING', 'ACCEPTEE', 'PREPARING']
                ).count()
                
                # Recent Transactions
                context['recent_orders'] = Order.objects.filter(bar=bar).order_by('-date_creation')[:10]
                
                # Data for Service Mode (Taking Orders)
                context['tables'] = Table.objects.filter(bar=bar).order_by('nom')
                context['categories'] = Category.objects.all().order_by('nom')
                context['inventory_items'] = StockItem.objects.filter(bar=bar).select_related('produit', 'produit__categorie')
                
                # Critical Stock
                critical_items = StockItem.objects.filter(
                    bar=bar,
                    quantite_actuelle__lte=F('seuil_alerte')
                ).select_related('produit')[:5]
                
                critical_stocks_with_percent = []
                for item in critical_items:
                    percent = int((item.quantite_actuelle / item.seuil_alerte * 100)) if item.seuil_alerte > 0 else 0
                    critical_stocks_with_percent.append({
                        'item': item,
                        'percent': min(100, percent)
                    })
                context['critical_stocks'] = critical_stocks_with_percent
                
        except PilotProfile.DoesNotExist:
            pass
            
        return context

class TakeOrderView(LoginRequiredMixin, View):
    """Permet au propriétaire de prendre une commande directement."""
    def post(self, request):
        profile = PilotProfile.objects.get(user=request.user)
        order = take_order_for_profile(
            bar=profile.bar,
            pilot_profile=profile,
            table_id=request.POST.get('table_id'),
            items_raw=request.POST.getlist('items[]'),
        )
        if order:
            notify_order_created(order, actor=request.user)
        return redirect('dashboard_html')

class EstablishmentSetupView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/establishment_setup.html'
    
    def post(self, request, *args, **kwargs):
        bar_type = request.POST.get('type', 'BAR')
        # On stocke temporairement le type en session pour le second écran
        request.session['setup_bar_type'] = bar_type
        return redirect('establishment_details')

class EstablishmentDetailsView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/establishment_details.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['profile'] = PilotProfile.objects.get(user=self.request.user)
        context['bar_type'] = self.request.session.get('setup_bar_type', 'BAR')
        context['google_maps_api_key'] = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        return context
    
    def post(self, request, *args, **kwargs):
        name = request.POST.get('name')
        address = request.POST.get('address')
        bar_type = request.session.get('setup_bar_type', 'BAR')
        monthly_price_per_table_usd = request.POST.get('monthly_price_per_table_usd', 2.5)
        try:
            monthly_price_per_table_usd = Decimal(str(monthly_price_per_table_usd or 2.5))
        except Exception:
            monthly_price_per_table_usd = Decimal('2.50')
        
        if name:
            # Create the bar
            new_bar = Bar.objects.create(
                nom=name, 
                adresse=address,
                type_etablissement=bar_type,
                prix_mensuel_par_table_usd=monthly_price_per_table_usd,
            )
            
            if 'logo' in request.FILES:
                new_bar.logo = request.FILES['logo']
            
            new_bar.save()
            
            # Link to profile and keep the active bar on the new establishment
            profile = PilotProfile.objects.get(user=request.user)
            profile.bar = new_bar
            profile.save(update_fields=['bar'])
            profile.owned_bars.add(new_bar)
            trial_granted = grant_trial_if_eligible(profile, new_bar)
            record_owner_audit(
                profile,
                new_bar,
                'TRIAL_GRANTED' if trial_granted else 'TRIAL_DENIED',
                request=request,
                details={'bar_created': True, 'trial_granted': trial_granted, 'bar_name': new_bar.nom},
            )
            
            # Nettoyage session
            if 'setup_bar_type' in request.session:
                del request.session['setup_bar_type']
                
            return redirect('table_setup')
            
        return self.get(request, *args, **kwargs)

class SwitchEstablishmentView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(PilotProfile, user=request.user)
        bar_id = request.POST.get('bar_id')
        next_url = request.POST.get('next') or request.META.get('HTTP_REFERER') or reverse('dashboard_html')
        if not bar_id:
            payload = {'success': False, 'error': 'Etablissement manquant.'}
            live_response = _live_payload(request, payload, status=400)
            if live_response is not None:
                return live_response
            return redirect(next_url)

        bar = profile.owned_bars.filter(id=bar_id).first()
        if not bar:
            payload = {'success': False, 'error': 'Vous ne possedez pas cet etablissement.'}
            live_response = _live_payload(request, payload, status=403)
            if live_response is not None:
                return live_response
            return redirect(next_url)

        profile.bar = bar
        profile.save(update_fields=['bar'])
        record_owner_audit(profile, bar, 'BAR_SWITCHED', request=request, details={'bar_name': bar.nom})
        messages.success(request, f'Etablissement active: {bar.nom}')

        payload = {
            'success': True,
            'message': f'Etablissement bascule vers {bar.nom}.',
            'redirect_url': next_url,
            'current_bar': {'id': str(bar.id), 'nom': bar.nom, 'exchange_rate': float(bar.taux_change_usd_to_cdf or 2800)},
        }
        live_response = _live_payload(request, payload)
        if live_response is not None:
            return live_response
        return redirect(next_url)


class TableSetupView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/table_setup.html'
    
    def post(self, request, *args, **kwargs):
        count = request.POST.get('table_count', 0)
        try:
            count = int(count)
        except ValueError:
            count = 0
            
        profile = PilotProfile.objects.get(user=request.user)
        if profile.bar and count > 0:
            now = timezone.now()
            expires_at = now + timedelta(days=30)
            # Create N tables with an initial 30-day subscription.
            for i in range(1, count + 1):
                Table.objects.create(
                    bar=profile.bar,
                    nom=f"Table {i}",
                    est_active=True,
                    subscription_started_at=now,
                    subscription_expires_at=expires_at,
                )
            # Fin de l'onboarding -> Redirection vers la page de succès/téléchargement staff
            return redirect('establishment_ready')
            
        return self.get(request, *args, **kwargs)

class ProfileSetupView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/profile_setup.html'
    
    def post(self, request, *args, **kwargs):
        profile = PilotProfile.objects.get(user=request.user)
        
        profile.nom = request.POST.get('nom', '').upper()
        profile.postnom = request.POST.get('postnom', '').upper()
        profile.prenom = request.POST.get('prenom', '').capitalize()
        profile.sexe = request.POST.get('sexe', 'M')
        profile.telephone = request.POST.get('telephone', '')
        
        if 'photo_profil' in request.FILES:
            profile.photo_profil = request.FILES['photo_profil']
        
        profile.save()
        
        return redirect('login_redirect')

class InventoryView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/inventory.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        if profile.bar:
            context['inventory_items'] = StockItem.objects.filter(bar=profile.bar).select_related('produit', 'produit__categorie')
            context['categories'] = Category.objects.all()
            context['bar'] = profile.bar
        return context

    def post(self, request, *args, **kwargs):
        from django.contrib import messages
        from decimal import Decimal
        item_id = request.POST.get('item_id')
        item = StockItem.objects.select_related('produit').get(id=item_id)
        
        # Mise à jour des champs avec conversion Decimal
        item.prix_vente_unitaire = Decimal(request.POST.get('prix_vente', 0) or 0)
        item.quantite_actuelle = Decimal(request.POST.get('quantite', 0) or 0)
        item.seuil_alerte = int(request.POST.get('seuil', 12) or 12)
        item.devise = request.POST.get('devise', 'USD')
        
        # --- Vente au verre ---
        item.vente_au_verre = request.POST.get('vente_au_verre') == 'on'
        item.volume_verre_cl = int(request.POST.get('volume_verre_cl', 5) or 5)
        item.prix_vente_verre = Decimal(request.POST.get('prix_vente_verre', 0) or 0)
        item.reduction_bouteille_entiere = Decimal(request.POST.get('reduction_bouteille', 0) or 0)
        
        # Mise à jour du volume sur le produit master
        if request.POST.get('volume_cl'):
            item.produit.volume_cl = int(request.POST.get('volume_cl'))
            item.produit.save()
        # ----------------------

        # Gestion Casier vs Unité
        item.strategie_gestion = request.POST.get('strategie', 'UNITE')
        item.bouteilles_par_casier = int(request.POST.get('bouteilles_par_casier', 24) or 24)
        item.prix_achat_casier = Decimal(request.POST.get('prix_achat_casier', 0) or 0)
        
        if item.strategie_gestion == 'UNITE':
            item.prix_achat_unitaire = Decimal(request.POST.get('prix_achat_unitaire', 0) or 0)

        # Arrivage rapide : On ajoute la quantité saisie au stock actuel
        qty_to_add = Decimal(request.POST.get('qty_to_add', 0) or 0)
        if qty_to_add > 0:
            item.quantite_actuelle += qty_to_add
        
        item.save()
        messages.success(request, f"Configuration de {item.produit.nom} mise à jour !")
        return redirect('inventory_html')

class FinanceView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/finance.html'
    
    def post(self, request, *args, **kwargs):
        from decimal import Decimal
        from django.contrib import messages
        profile = PilotProfile.objects.get(user=request.user)
        bar = profile.bar
        
        action = request.POST.get('action')
        if action == 'update_rate':
            rate = request.POST.get('taux')
            if rate:
                bar.taux_change_usd_to_cdf = Decimal(rate)
                bar.save(update_fields=['taux_change_usd_to_cdf'])
                payload = {
                    'success': True,
                    'message': f"Taux de change mis à jour : 1$ = {rate} FC",
                    'exchange_rate': float(bar.taux_change_usd_to_cdf or 2800),
                    'dispatch_event': {
                        'type': 'barpilote:exchange-rate-changed',
                        'detail': {'exchange_rate': float(bar.taux_change_usd_to_cdf or 2800)},
                    },
                }
                live = _live_payload(request, payload)
                if live is not None:
                    return live
                messages.success(request, payload['message'])
        
        return redirect('finance_html')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        bar = profile.bar
        context['bar'] = bar
        
        if not bar:
            return context
            
        # 1. Gestion des Dates (Filtre)
        start_date_str = self.request.GET.get('start_date')
        end_date_str = self.request.GET.get('end_date')
        
        if start_date_str and end_date_str:
            start_date = timezone.datetime.strptime(start_date_str, '%Y-%m-%d').replace(tzinfo=timezone.get_current_timezone())
            end_date = timezone.datetime.strptime(end_date_str, '%Y-%m-%d').replace(tzinfo=timezone.get_current_timezone(), hour=23, minute=59, second=59)
        else:
            # Par défaut : 30 derniers jours
            end_date = timezone.now()
            start_date = end_date - timedelta(days=30)
            
        context['start_date'] = start_date.strftime('%Y-%m-%d')
        context['end_date'] = end_date.strftime('%Y-%m-%d')
        
        # 2. Calculs Financiers (Ventes)
        orders = Order.objects.filter(bar=bar, statut='PAID', date_creation__range=(start_date, end_date))
        
        revenue_data = orders.aggregate(
            total_usd=Sum('total_usd'),
            total_cdf=Sum('total_cdf'),
            count=Count('id')
        )
        
        context['revenue_usd'] = revenue_data['total_usd'] or 0
        context['revenue_cdf'] = revenue_data['total_cdf'] or 0
        context['total_orders'] = revenue_data['count'] or 0
        
        # Panier moyen (calculé pour les deux devises)
        if context['total_orders'] > 0:
            context['avg_basket_usd'] = (revenue_data['total_usd'] or 0) / context['total_orders']
            context['avg_basket_cdf'] = (revenue_data['total_cdf'] or 0) / context['total_orders']
        else:
            context['avg_basket_usd'] = 0
            context['avg_basket_cdf'] = 0
            
        # 3. Calculs des Pertes (Perte sèche)
        from .models import Perte
        pertes = Perte.objects.filter(bar=bar, date_perte__range=(start_date, end_date))
        
        # On calcule la perte en se basant sur le prix d'achat unitaire au moment de l'inventaire
        # Note: Dans un système parfait, on stockerait le prix au moment de la perte.
        total_perte_usd = 0
        total_perte_cdf = 0
        
        pertes_par_produit = []
        
        # Agrégation des pertes par produit
        items_perdus = pertes.values('item__produit__nom', 'item__devise', 'item__prix_achat_unitaire').annotate(
            total_qty=Sum('quantite')
        ).order_by('-total_qty')
        
        for p in items_perdus:
            montant = p['total_qty'] * (p['item__prix_achat_unitaire'] or 0)
            if p['item__devise'] == 'CDF':
                total_perte_cdf += montant
            else:
                total_perte_usd += montant
                
            pertes_par_produit.append({
                'nom': p['item__produit__nom'],
                'quantite': p['total_qty'],
                'montant': montant,
                'devise': p['item__devise']
            })
            
        context['total_perte_usd'] = total_perte_usd
        context['total_perte_cdf'] = total_perte_cdf
        context['pertes_par_produit'] = pertes_par_produit

        pertes_detaillees = []
        for perte in pertes.select_related('item__produit', 'reported_by', 'reported_by__user').order_by('-date_perte', '-id'):
            reporter = 'Non renseigné'
            if perte.reported_by:
                name_parts = [perte.reported_by.prenom, perte.reported_by.nom, perte.reported_by.postnom]
                reporter = ' '.join(part for part in name_parts if part).strip()
                if not reporter:
                    reporter = perte.reported_by.user.get_full_name() or perte.reported_by.user.get_username()

            commentaire = (perte.commentaire or '').strip()
            if commentaire.startswith('Signalé par '):
                if '. ' in commentaire:
                    declared_name, commentaire = commentaire.split('. ', 1)
                    if reporter == 'Non renseigné':
                        reporter = declared_name.replace('Signalé par ', '').strip() or reporter
                    commentaire = commentaire.strip()
                else:
                    declared_name = commentaire.replace('Signalé par ', '').rstrip('.').strip()
                    if reporter == 'Non renseigné' and declared_name:
                        reporter = declared_name
                    commentaire = ''

            prix_achat = perte.item.prix_achat_unitaire or 0
            montant = perte.quantite * prix_achat
            pertes_detaillees.append({
                'date': perte.date_perte,
                'declarant': reporter,
                'boisson': perte.item.produit.nom,
                'quantite': perte.quantite,
                'raison': perte.get_raison_display(),
                'commentaire': commentaire,
                'montant': montant,
                'devise': perte.item.devise,
            })

        context['pertes_detaillees'] = pertes_detaillees
            
        # 4. Gestion des Factures (Dettes et Dépenses)
        from .models import Facture
        from django.db.models import Q
        
        # On inclut toutes les factures de la période, PLUS toutes les factures IMPAYÉES historiques (pour pouvoir les chercher et les encaisser)
        factures = Facture.objects.filter(bar=bar).filter(
            Q(date_emission__range=(start_date, end_date)) | Q(statut='IMPAYEE')
        ).order_by('-date_emission').distinct()
        context['factures'] = factures
        
        # Les factures clients IMPAYÉES créées dans la période sont considérées comme de la perte pour cette période
        unpaid_client_invoices_period = Facture.objects.filter(
            bar=bar,
            type_facture='CLIENT',
            statut='IMPAYEE',
            date_emission__range=(start_date, end_date)
        )
        unpaid_usd = unpaid_client_invoices_period.aggregate(Sum('montant_usd'))['montant_usd__sum'] or 0
        unpaid_cdf = unpaid_client_invoices_period.aggregate(Sum('montant_cdf'))['montant_cdf__sum'] or 0
        
        context['total_perte_usd'] += unpaid_usd
        context['total_perte_cdf'] += unpaid_cdf
        
        # Pour le modal d'enregistrement de perte
        context['inventory_items'] = StockItem.objects.filter(bar=bar).select_related('produit')
        
        # 5. Performance des ventes (pour la section Performance Ventes)
        from .models import OrderItem, Category
        from django.db import models as django_models
        from decimal import Decimal
        
        # Calculer les ventes sur la période via OrderItem (lié aux orders payés)
        order_items = OrderItem.objects.filter(
            order__bar=bar, 
            order__statut='PAID',
            order__date_creation__range=(start_date, end_date)
        )
        
        # Performance par catégorie
        category_performance = []
        for cat in Category.objects.all():
            cat_items = order_items.filter(product_item__produit__categorie=cat)
            cat_revenue_usd = cat_items.filter(devise='USD').aggregate(
                total=Sum(django_models.F('quantite') * django_models.F('prix_unitaire'))
            )['total'] or 0
            cat_revenue_cdf = cat_items.filter(devise='CDF').aggregate(
                total=Sum(django_models.F('quantite') * django_models.F('prix_unitaire'))
            )['total'] or 0
            
            # Convertir CDF en USD pour comparaison
            cat_revenue_total_usd = cat_revenue_usd + (cat_revenue_cdf / Decimal(bar.taux_change_usd_to_cdf or 2800))
            
            if cat_revenue_total_usd > 0:
                category_performance.append({
                    'nom': cat.nom,
                    'icon': cat.icon or 'local_drink',
                    'revenue_usd': cat_revenue_usd,
                    'revenue_cdf': cat_revenue_cdf,
                    'revenue_total_usd': cat_revenue_total_usd,
                    'ventes_count': cat_items.count()
                })
        
        # Trier par revenu total
        category_performance.sort(key=lambda x: x['revenue_total_usd'], reverse=True)
        context['category_performance'] = category_performance[:5]  # Top 5 catégories
        
        # Produits les plus vendus
        top_products = order_items.values('product_item__produit__nom').annotate(
            total_qty=Sum('quantite'),
            total_revenue_usd=Sum(django_models.F('quantite') * django_models.F('prix_unitaire'), 
                                 output_field=django_models.DecimalField())
        ).filter(devise='USD').order_by('-total_revenue_usd')[:5]
        
        context['top_products'] = top_products
        
        # Évolution journalière (derniers 7 jours de la période)
        daily_performance = []
        for i in range(7):
            day = end_date - timedelta(days=6-i)
            day_start = day.replace(hour=0, minute=0, second=0)
            day_end = day.replace(hour=23, minute=59, second=59)
            
            day_items = order_items.filter(order__date_creation__range=(day_start, day_end))
            day_revenue_usd = day_items.filter(devise='USD').aggregate(
                total=Sum(django_models.F('quantite') * django_models.F('prix_unitaire'))
            )['total'] or 0
            day_revenue_cdf = day_items.filter(devise='CDF').aggregate(
                total=Sum(django_models.F('quantite') * django_models.F('prix_unitaire'))
            )['total'] or 0
            
            daily_performance.append({
                'date': day.strftime('%d/%m'),
                'revenue_usd': day_revenue_usd,
                'revenue_cdf': day_revenue_cdf,
                'ventes_count': day_items.count()
            })
        
        context['daily_performance'] = daily_performance
        
        return context

class FactureActionView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        from django.contrib import messages
        from .models import Facture, PilotProfile
        import uuid
        
        action = request.POST.get('action')
        profile = PilotProfile.objects.get(user=request.user)
        
        if action == 'create':
            client = request.POST.get('client')
            montant_usd = request.POST.get('montant_usd', 0)
            montant_cdf = request.POST.get('montant_cdf', 0)
            type_f = request.POST.get('type_facture', 'CLIENT')
            
            facture = Facture.objects.create(
                bar=profile.bar,
                numero=f"FAC-{uuid.uuid4().hex[:6].upper()}",
                client_fournisseur=client,
                montant_usd=montant_usd or 0,
                montant_cdf=montant_cdf or 0,
                type_facture=type_f,
                statut='IMPAYEE'
            )
            if facture.type_facture == 'CLIENT':
                notify_debt_created(facture, actor=request.user)
            payload = {
                'success': True,
                'message': "Facture enregistrée.",
                'dispatch_event': {'type': 'barpilote:finance-changed', 'detail': {'facture_id': str(facture.id), 'action': 'create'}},
            }
            live = _live_payload(request, payload)
            if live is not None:
                return live
            messages.success(request, payload['message'])
            
        elif action == 'pay':
            facture_id = request.POST.get('facture_id')
            facture = Facture.objects.get(id=facture_id, bar=profile.bar)
            facture.statut = 'PAYEE'
            facture.date_paiement = timezone.now()
            facture.save(update_fields=['statut', 'date_paiement'])
            notify_bar_owners(
                profile.bar,
                actor=request.user,
                category='DEBT',
                title=f"Dette réglée - {facture.client_fournisseur}",
                message=f"La facture {facture.numero} a été marquée comme payée.",
                url='/proprietaire/finance/',
            )
            payload = {
                'success': True,
                'message': f"Facture {facture.numero} marquée comme payée.",
                'text_updates': {f'#facture-status-{facture.id}': 'PAYEE'},
                'dispatch_event': {'type': 'barpilote:finance-changed', 'detail': {'facture_id': str(facture.id), 'action': 'pay'}},
            }
            live = _live_payload(request, payload)
            if live is not None:
                return live
            messages.success(request, payload['message'])
            
        elif action == 'delete':
            facture_id = request.POST.get('facture_id')
            facture = Facture.objects.get(id=facture_id, bar=profile.bar)
            facture.delete()
            payload = {
                'success': True,
                'message': 'Facture supprimée.',
                'remove_selectors': [f'#facture-row-{facture_id}'],
                'dispatch_event': {'type': 'barpilote:finance-changed', 'detail': {'facture_id': str(facture_id), 'action': 'delete'}},
            }
            live = _live_payload(request, payload)
            if live is not None:
                return live
            messages.success(request, payload['message'])

        return redirect('finance_html')

class RecordLossView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        from django.contrib import messages
        from .models import Perte, StockItem
        
        item_id = request.POST.get('item_id')
        quantite = int(request.POST.get('quantite', 1))
        raison = request.POST.get('raison', 'CASSE')
        commentaire = request.POST.get('commentaire', '')
        
        profile = PilotProfile.objects.get(user=request.user)
        item = StockItem.objects.get(id=item_id, bar=profile.bar)
        
        # Enregistrer la perte
        Perte.objects.create(
            bar=profile.bar,
            item=item,
            reported_by=profile,
            quantite=quantite,
            raison=raison,
            commentaire=commentaire
        )
        
        # Déduire du stock
        item.quantite_actuelle = max(0, item.quantite_actuelle - quantite)
        item.save()
        
        payload = {
            'success': True,
            'message': f"Perte de {quantite} x {item.produit.nom} enregistrée. Stock mis à jour.",
            'dispatch_event': {'type': 'barpilote:inventory-changed', 'detail': {'item_id': str(item.id), 'quantite': quantite}},
        }
        live = _live_payload(request, payload)
        if live is not None:
            return live
        messages.success(request, payload['message'])
        
        if profile.role == 'SERVEUR':
            return redirect('serveur_dashboard')
        return redirect('finance_html')

class TeamView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/team.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        context['bar'] = profile.bar
        if profile.bar:
            context['advisor_settings'] = BarAdvisorSettings.objects.get_or_create(bar=profile.bar)[0]
        if profile.bar:
            from serveur.models import ServeurProfile

            context['staff'] = PilotProfile.objects.filter(bar=profile.bar).exclude(role='PROPRIETAIRE')
            serveur_staff = list(
                ServeurProfile.objects.filter(
                    bar=profile.bar,
                    confirmation_status='CONFIRMED',
                    actif=True,
                ).select_related('user').order_by('date_embauche', 'prenom', 'nom')
            )

            rate = Decimal(profile.bar.taux_change_usd_to_cdf or 2800)
            for member in serveur_staff:
                member_pilot = PilotProfile.objects.filter(user=member.user, bar=profile.bar).first()
                member.is_online = bool(member_pilot and member_pilot.is_online)
                member.hierarchy_level = 3
                if member.tables_access_granted:
                    member.hierarchy_level = 2
                if member.reports_access_granted:
                    member.hierarchy_level = 1
                if member.inventory_access_granted:
                    member.hierarchy_level = min(member.hierarchy_level, 2)

                paid_orders = Order.objects.filter(bar=profile.bar, serveur=member_pilot, statut='PAID') if member_pilot else Order.objects.none()
                served_orders = Order.objects.filter(bar=profile.bar, serveur=member_pilot, statut__in=['SERVED', 'PAID']) if member_pilot else Order.objects.none()
                member.tables_managed = served_orders.values('table_id').distinct().count()
                member.orders_served = served_orders.count()
                member.paid_orders_count = paid_orders.count()
                totals = paid_orders.aggregate(total_usd=Sum('total_usd'), total_cdf=Sum('total_cdf'))
                member.impact_usd = totals['total_usd'] or 0
                member.impact_cdf = totals['total_cdf'] or 0
                member.impact_total_usd = Decimal(member.impact_usd or 0) + (Decimal(member.impact_cdf or 0) / rate)
                member.avg_order_usd = (member.impact_total_usd / member.paid_orders_count) if member.paid_orders_count else Decimal('0')
                open_debt = Facture.objects.filter(bar=profile.bar, orders__serveur=member_pilot, type_facture='CLIENT', statut='IMPAYEE').distinct() if member_pilot else Facture.objects.none()
                debt_totals = open_debt.aggregate(total_usd=Sum('montant_usd'), total_cdf=Sum('montant_cdf'))
                member.open_debt_usd = debt_totals['total_usd'] or 0
                member.open_debt_cdf = debt_totals['total_cdf'] or 0

                # Note composite: on privilégie les volumes payés, le panier moyen, puis on pénalise les impayés.
                debt_penalty = Decimal(member.open_debt_usd or 0) + (Decimal(member.open_debt_cdf or 0) / rate)
                member.team_rating_score = float(
                    (Decimal(member.impact_total_usd or 0) * Decimal('0.55'))
                    + (Decimal(member.avg_order_usd or 0) * Decimal('0.30'))
                    + (Decimal(member.paid_orders_count or 0) * Decimal('1.5'))
                    + (Decimal(member.orders_served or 0) * Decimal('0.5'))
                    - (debt_penalty * Decimal('0.25'))
                )
                member.team_rating_label = max(0.0, min(100.0, member.team_rating_score))
                member.is_current_server = member.user_id == self.request.user.id

            def _team_sort_key(member):
                return (
                    member.hierarchy_level,
                    -float(member.team_rating_label),
                    member.date_embauche or timezone.now().date(),
                    member.prenom or '',
                    member.nom or '',
                )

            serveur_staff.sort(key=_team_sort_key)
            for index, member in enumerate(serveur_staff, start=1):
                member.performance_rank = index
            context['serveur_staff'] = serveur_staff
            context['pending_requests'] = ServeurProfile.objects.filter(
                bar=profile.bar,
                confirmation_status='PENDING',
                actif=True,
            ).select_related('user').order_by('-updated_at')
        return context


class AdvisorSettingsView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(PilotProfile, user=request.user, role='PROPRIETAIRE')
        if not profile.bar:
            messages.error(request, 'Aucun établissement actif.')
            return redirect('team_html')

        settings_obj, _ = BarAdvisorSettings.objects.get_or_create(bar=profile.bar)
        provider = 'local'

        settings_obj.owner_enabled = request.POST.get('owner_enabled') == '1'
        settings_obj.server_enabled = request.POST.get('server_enabled') == '1'
        settings_obj.provider = provider
        settings_obj.save(update_fields=['owner_enabled', 'server_enabled', 'provider', 'updated_at'])
        messages.success(request, 'Réglages du conseiller IA enregistrés.')
        return redirect('team_html')


class TeamRequestActionView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        from django.contrib import messages
        from serveur.models import ServeurProfile

        profile = get_object_or_404(PilotProfile, user=request.user, role='PROPRIETAIRE')
        server_profile = get_object_or_404(
            ServeurProfile,
            id=request.POST.get('server_profile_id'),
            bar=profile.bar,
            confirmation_status='PENDING',
        )
        action = request.POST.get('action')

        if action == 'approve':
            server_profile.confirmation_status = 'CONFIRMED'
            server_profile.actif = True
            server_profile.inventory_access_granted = False
            server_profile.tables_access_granted = False
            server_profile.reports_access_granted = False
            server_profile.save(update_fields=['confirmation_status', 'actif', 'inventory_access_granted', 'tables_access_granted', 'reports_access_granted', 'updated_at'])

            pilot_profile, _ = PilotProfile.objects.get_or_create(user=server_profile.user)
            pilot_profile.role = 'SERVEUR'
            pilot_profile.bar = profile.bar
            pilot_profile.nom = server_profile.nom
            pilot_profile.postnom = server_profile.postnom
            pilot_profile.prenom = server_profile.prenom
            pilot_profile.sexe = server_profile.sexe
            pilot_profile.telephone = server_profile.telephone
            pilot_profile.save()

            notify_user(
                server_profile.user,
                actor=request.user,
                bar=profile.bar,
                category='TEAM',
                title='Vous avez été ajouté à l’équipe',
                message=f"Votre accès à {profile.bar.nom} est confirmé.",
                url='/serveur/dashboard/',
            )
            notify_bar_owners(
                profile.bar,
                actor=request.user,
                category='TEAM',
                title='Serveur ajouté',
                message=f"{server_profile.prenom} {server_profile.nom} a rejoint l’équipe.",
                url='/proprietaire/team/',
            )
            message = f"{server_profile.prenom} {server_profile.nom} a ete ajoute a votre equipe."
        elif action == 'reject':
            server_profile.confirmation_status = 'REJECTED'
            server_profile.actif = False
            server_profile.save(update_fields=['confirmation_status', 'actif', 'updated_at'])
            notify_user(
                server_profile.user,
                actor=request.user,
                bar=profile.bar,
                category='TEAM',
                title='Demande serveur rejetée',
                message=f"Votre demande pour {profile.bar.nom} a été rejetée.",
                url='/serveur/scan/',
            )
            message = f"La demande de {server_profile.prenom} {server_profile.nom} a ete rejetee."
        else:
            message = "Action invalide."

        payload = {
            'success': action in {'approve', 'reject'},
            'message': message,
            'remove_selectors': [f'#pending-request-{server_profile.id}'] if action in {'approve', 'reject'} else [],
        }
        live = _live_payload(request, payload)
        if live is not None:
            return live
        if action in {'approve', 'reject'}:
            messages.success(request, message)
        else:
            messages.error(request, message)
        return redirect('team_html')


class TeamAccessActionView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        from django.contrib import messages
        from serveur.models import ServeurProfile

        profile = get_object_or_404(PilotProfile, user=request.user, role='PROPRIETAIRE')
        server_profile = get_object_or_404(
            ServeurProfile,
            id=request.POST.get('server_profile_id'),
            bar=profile.bar,
            confirmation_status='CONFIRMED',
            actif=True,
        )
        permission = request.POST.get('permission')
        enabled = request.POST.get('enabled') == '1'

        permission_map = {
            'inventory': 'inventory_access_granted',
            'tables': 'tables_access_granted',
            'reports': 'reports_access_granted',
        }
        field_name = permission_map.get(permission)
        if not field_name:
            messages.error(request, "Autorisation invalide.")
            return redirect('team_html')

        setattr(server_profile, field_name, enabled)
        server_profile.save(update_fields=[field_name, 'updated_at'])

        labels = {
            'inventory': 'inventaire',
            'tables': 'tables',
            'reports': 'rapports',
        }
        state = 'accordé' if enabled else 'retiré'
        notify_user(
            server_profile.user,
            actor=request.user,
            bar=profile.bar,
            category='TEAM',
            title=f"Accès {labels[permission]} {state}",
            message=f"Votre accès {labels[permission]} a été {state}.",
            url='/serveur/dashboard/',
        )
        payload = {
            'success': True,
            'message': f"Accès {labels[permission]} {state} pour {server_profile.prenom} {server_profile.nom}.",
            'dispatch_event': {
                'type': 'barpilote:team-permission-changed',
                'detail': {
                    'server_profile_id': str(server_profile.id),
                    'permission': permission,
                    'enabled': enabled,
                },
            },
        }
        live = _live_payload(request, payload)
        if live is not None:
            return live
        messages.success(request, payload['message'])
        return redirect('team_html')


class TablesView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/tables.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        bar = profile.bar
        if bar:
            # Récupérer toutes les tables
            tables = Table.objects.filter(bar=bar).order_by('nom')
            
            # Identifier les tables occupées (commandes non payées/annulées)
            active_orders = Order.objects.filter(
                bar=bar,
                statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']
            ).select_related('table')
            
            occupied_tables = {}
            for order in active_orders:
                # On garde la commande la plus récente si plusieurs (cas rare)
                occupied_tables[order.table_id] = {
                    'order_id': order.id,
                    'total_usd': order.total_usd,
                    'total_cdf': order.total_cdf,
                    'statut': order.get_statut_display(),
                    'heure': order.date_creation
                }
            
            # Enrichir les objets tables pour le template
            for table in tables:
                table.is_occupied = str(table.id) in [str(k) for k in occupied_tables.keys()]
                if table.is_occupied:
                    # On fait attention à la correspondance des IDs UUID
                    info = occupied_tables.get(table.id)
                    if not info: # fallback check
                         for k, v in occupied_tables.items():
                             if str(k) == str(table.id):
                                 info = v
                                 break
                    table.order_info = info
            
            context['tables'] = tables
            context['occupied_count'] = len(occupied_tables)
            context['free_count'] = tables.count() - len(occupied_tables)
        return context

class EstablishmentReadyView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/establishment_ready.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        context['bar'] = profile.bar
        return context

class TableActionView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        from django.contrib import messages
        from .models import Order
        action = request.POST.get('action')
        table_id = request.POST.get('table_id')
        profile = PilotProfile.objects.get(user=request.user)
        payload = {'success': False}
        
        if action == 'rename' and table_id:
            new_name = request.POST.get('name')
            if new_name:
                table = Table.objects.get(id=table_id, bar=profile.bar)
                table.nom = new_name
                table.save(update_fields=['nom'])
                notify_bar_servers(profile.bar, actor=request.user, category='TABLE', title='Table renommée', message=f"Une table a été renommée en {new_name}.", url='/serveur/tables/')
                notify_bar_owners(profile.bar, actor=request.user, category='TABLE', title='Table renommée', message=f"Une table a été renommée en {new_name}.", url='/proprietaire/tables/')
                payload = {'success': True, 'message': f"Table renommée en {new_name}.", 'text_updates': {f'#table-name-{table.id}': new_name}, 'dispatch_event': {'type': 'barpilote:tables-changed', 'detail': {'table_id': str(table.id), 'action': 'rename'}}}
        
        elif action == 'liberate' and table_id:
            orders_to_close = list(Order.objects.filter(bar=profile.bar, table_id=table_id, statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']))
            now = timezone.now()
            updated = Order.objects.filter(id__in=[order.id for order in orders_to_close]).update(statut='PAID', date_maj=now)
            if orders_to_close:
                try:
                    from client.models import ClientOrderMeta
                    ClientOrderMeta.objects.filter(order__in=orders_to_close).update(payment_requested=False, payment_confirmed_at=now, table_released_at=now, updated_at=now)
                except Exception:
                    pass
            payload = {'success': True, 'message': f"La table a été libérée. {updated} commande(s) clôturée(s).", 'dispatch_event': {'type': 'barpilote:tables-changed', 'detail': {'table_id': str(table_id), 'action': 'liberate', 'updated_orders': updated}}}

        elif action == 'delete' and table_id:
            has_active_orders = Order.objects.filter(bar=profile.bar, table_id=table_id, statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']).exists()
            if has_active_orders:
                payload = {'success': False, 'message': "Impossible de supprimer une table occupée. Libérez-la d'abord."}
            else:
                table = Table.objects.get(id=table_id, bar=profile.bar)
                table_name = table.nom
                table.delete()
                notify_bar_servers(profile.bar, actor=request.user, category='TABLE', title='Table supprimée', message=f"{table_name} a été retirée du plan de salle.", url='/serveur/tables/')
                notify_bar_owners(profile.bar, actor=request.user, category='TABLE', title='Table supprimée', message=f"{table_name} a été retirée du plan de salle.", url='/proprietaire/tables/')
                payload = {'success': True, 'message': 'La table a été supprimée avec succès.', 'remove_selectors': [f'#table-card-{table_id}'], 'dispatch_event': {'type': 'barpilote:tables-changed', 'detail': {'table_id': str(table_id), 'action': 'delete'}}}

        elif action == 'activate_subscription' and table_id:
            try:
                days = int(request.POST.get('days', 30) or 30)
            except ValueError:
                days = 30
            days = max(1, days)
            table = Table.objects.get(id=table_id, bar=profile.bar)
            now = timezone.now()
            base = table.subscription_expires_at if table.subscription_expires_at and table.subscription_expires_at > now else now
            if not table.subscription_started_at or not table.subscription_expires_at or table.subscription_expires_at <= now:
                table.subscription_started_at = now
            table.subscription_expires_at = base + timedelta(days=days)
            table.est_active = True
            table.save(update_fields=['subscription_started_at', 'subscription_expires_at', 'est_active'])
            payload = {'success': True, 'message': f"Abonnement activé pour {table.nom} jusqu'au {timezone.localtime(table.subscription_expires_at).strftime('%d/%m/%Y %H:%M')}.", 'dispatch_event': {'type': 'barpilote:tables-changed', 'detail': {'table_id': str(table.id), 'action': 'activate_subscription'}}}

        elif action == 'add':
            count = request.POST.get('count', 0)
            try:
                count = int(count)
            except ValueError:
                count = 0
                
            if profile.bar and count > 0:
                tables = Table.objects.filter(bar=profile.bar, nom__startswith="Table ")
                max_num = 0
                for t in tables:
                    try:
                        num = int(t.nom.split(" ")[1])
                        if num > max_num:
                            max_num = num
                    except (IndexError, ValueError):
                        continue
                start_index = max_num + 1
                created_names = []
                created_ids = []
                for i in range(start_index, start_index + count):
                    table = Table.objects.create(bar=profile.bar, nom=f"Table {i}", est_active=True)
                    created_names.append(table.nom)
                    created_ids.append(str(table.id))
                if created_names:
                    notify_bar_servers(profile.bar, actor=request.user, category='TABLE', title='Nouvelles tables ajoutées', message=f"{len(created_names)} table(s) ajoutée(s): {', '.join(created_names[:4])}.", url='/serveur/tables/')
                    notify_bar_owners(profile.bar, actor=request.user, category='TABLE', title='Nouvelles tables ajoutées', message=f"{len(created_names)} table(s) ajoutée(s): {', '.join(created_names[:4])}.", url='/proprietaire/tables/')
                    payload = {'success': True, 'message': f"{len(created_names)} table(s) ajoutée(s).", 'dispatch_event': {'type': 'barpilote:tables-changed', 'detail': {'table_ids': created_ids, 'action': 'add'}}}
        
        live = _live_payload(request, payload)
        if live is not None:
            return live
        if payload.get('success'):
            messages.success(request, payload.get('message', 'Action effectuée.'))
        else:
            messages.error(request, payload.get('message', 'Action invalide.'))
        return redirect('tables_html')

class TableDownloadQRView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        table_id = request.GET.get('table_id')
        profile = PilotProfile.objects.get(user=request.user)
        
        if table_id:
            # Téléchargement individuel
            table = Table.objects.get(id=table_id, bar=profile.bar)
            return self.generate_qr_response(table)
        else:
            # Téléchargement groupé (ZIP)
            tables = Table.objects.filter(bar=profile.bar)
            return self.generate_zip_response(tables)

    def generate_qr_response(self, table):
        buffer = io.BytesIO()
        self.draw_badge(buffer, table)
        buffer.seek(0)
        
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response['Content-Disposition'] = f'attachment; filename="{table.nom.replace(" ", "_")}_Badge.pdf"'
        return response

    def draw_badge(self, buffer, table):
        # Format A6 (105 x 148 mm)
        c = canvas.Canvas(buffer, pagesize=A6)
        width, height = A6
        
        # Couleurs Premium
        orange_primary = HexColor("#FF5E00")
        gray_muted = HexColor("#94A3B8")
        dark_text = HexColor("#0F172A")
        
        # --- BACKGROUND ---
        c.setFillColor(HexColor("#FFFFFF"))
        c.rect(0, 0, width, height, stroke=0, fill=1)

        # 1. LOGO PRINCIPAL (Original BarPilote Logo - Orange Version)
        y_pos = height - 35*mm
        logo_path = os.path.join(settings.BASE_DIR, 'static', 'logo_orange.png')
        if os.path.exists(logo_path):
            l_size = 28*mm # Légèrement plus petit pour laisser de la place au texte
            c.drawImage(ImageReader(logo_path), (width - l_size)/2, y_pos, width=l_size, height=l_size, mask='auto')
            
            # Ajout du nom du site sous le logo
            c.setFillColor(orange_primary)
            c.setFont("Helvetica-Bold", 14)
            c.drawCentredString(width/2, y_pos - 5*mm, "BarPilote")
            y_pos -= 8*mm # Décalage supplémentaire pour le texte
        else:
            c.setFillColor(orange_primary)
            c.setFont("Helvetica-Bold", 16)
            c.drawCentredString(width/2, height - 20*mm, "BarPilote")
            
        # 2. NOM ÉTABLISSEMENT
        y_pos -= 4*mm
        c.setFillColor(gray_muted)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(width/2, y_pos, table.bar.nom.upper())
        
        # 3. TITRE DE LA TABLE
        y_pos -= 8*mm
        c.setFillColor(dark_text)
        c.setFont("Helvetica-Bold", 18) 
        c.drawCentredString(width/2, y_pos, table.nom)
        
        # 4. LABEL D'ACTIVITÉ (Souligné en orange)
        y_pos -= 6*mm
        c.setFillColor(orange_primary)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(width/2, y_pos, "ZONE DE SERVICE ACTIVE")
        
        # 5. QR CODE AREA
        qr_size = 58*mm
        qr_x = (width - qr_size) / 2
        y_pos -= 68*mm # Espace pour le QR
        
        # Bordure arrondie premium (Plus large radius)
        c.setStrokeColor(orange_primary)
        c.setLineWidth(1.2)
        padding = 4*mm
        c.roundRect(qr_x - padding, y_pos - padding, qr_size + padding*2, qr_size + padding*2, 12*mm, stroke=1, fill=0)
        
        # QR Code Generation
        qr_url = table.client_menu_url
        qr = qrcode.QRCode(version=1, box_size=10, border=0)
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        
        c.drawImage(ImageReader(qr_buffer), qr_x, y_pos, width=qr_size, height=qr_size)
        
        # 6. FOOTER (Juste sous le QR)
        y_footer = y_pos - 10*mm
        c.setFillColor(gray_muted)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(width/2, y_footer, "PORTAIL DE COMMANDE")
        
        # URL en bas (Orange et propre)
        y_footer -= 5*mm
        c.setFillColor(orange_primary)
        c.setFont("Helvetica", 8)
        url_text = str(qr_url or '').replace("https://", "").replace("http://", "")
        url_text = url_text.strip('/') or str(qr_url or '')
        if len(url_text) > 36:
            url_text = f"{url_text[:33]}..."
        
        c.drawCentredString(width/2, y_footer, url_text) 
        
        c.showPage()
        c.save()

class StaffInvitationPDFView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        from reportlab.lib.pagesizes import A4
        profile = PilotProfile.objects.get(user=request.user)
        bar = profile.bar
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        orange_primary = HexColor("#FF5E00")
        orange_light = HexColor("#FFF7ED")
        gray_muted = HexColor("#64748B")
        dark_text = HexColor("#0F172A")
        dark_pill = HexColor("#111827")

        # --- FOND GRIS TRÈS CLAIR ---
        c.setFillColor(HexColor("#F8FAFC"))
        c.rect(0, 0, width, height, stroke=0, fill=1)

        # 1. EN-TÊTE PAGE
        y_pos = height - 20*mm
        c.setFillColor(orange_primary)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(width/2, y_pos, "ONBOARDING")
        
        y_pos -= 10*mm
        c.setFillColor(dark_text)
        c.setFont("Helvetica-Bold", 32)
        c.drawCentredString(width/2, y_pos, "Badge du Personnel")
        
        y_pos -= 10*mm
        c.setFillColor(gray_muted)
        c.setFont("Helvetica", 11)
        description = f"Ce badge QR permet à vos serveurs de rejoindre automatiquement l'équipe de "
        c.drawString(width/2 - c.stringWidth(description + bar.nom, "Helvetica", 11)/2, y_pos, description)
        c.setFillColor(orange_primary)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(width/2 - c.stringWidth(description + bar.nom, "Helvetica", 11)/2 + c.stringWidth(description, "Helvetica", 11), y_pos, bar.nom.upper() + ".")

        # 2. CARTE CENTRALE (Le Badge)
        card_w, card_h = 100*mm, 150*mm
        card_x = (width - card_w) / 2
        card_y = y_pos - 165*mm
        
        # Dessin de la carte blanche arrondie
        c.setStrokeColor(HexColor("#E2E8F0"))
        c.setFillColor(HexColor("#FFFFFF"))
        c.roundRect(card_x, card_y, card_w, card_h, 15*mm, stroke=1, fill=1)
        
        # Éléments dans la carte
        inner_y = card_y + card_h - 15*mm
        logo_path = os.path.join(settings.BASE_DIR, 'static', 'logo_orange.png')
        if os.path.exists(logo_path):
            l_size = 15*mm
            c.drawImage(ImageReader(logo_path), width/2 - l_size - 2, inner_y, width=l_size, height=l_size, mask='auto')
            c.setFillColor(orange_primary)
            c.setFont("Helvetica-Bold", 16)
            c.drawString(width/2 + 2, inner_y + 5*mm, "BarPilote")
        
        inner_y -= 8*mm
        c.setFillColor(gray_muted)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(width/2, inner_y, bar.nom.upper())
        
        inner_y -= 10*mm
        c.setFont("Helvetica", 8)
        c.drawCentredString(width/2, inner_y, "Scannez pour rejoindre l'équipe et accéder au")
        inner_y -= 4*mm
        c.drawCentredString(width/2, inner_y, "système de commande")
        
        inner_y -= 12*mm
        c.setFillColor(dark_pill)
        c.roundRect(width/2 - 25*mm, inner_y - 2*mm, 50*mm, 8*mm, 4*mm, stroke=0, fill=1)
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(width/2, inner_y + 1*mm, "BADGE PERSONNEL")
        
        # QR Code Orange
        inner_y -= 65*mm
        qr_size = 55*mm
        c.setStrokeColor(orange_primary)
        c.setLineWidth(2.5)
        c.roundRect(width/2 - qr_size/2 - 3*mm, inner_y - 3*mm, qr_size + 6*mm, qr_size + 6*mm, 10*mm, stroke=1, fill=0)
        
        invite_url = f"{settings.SITE_URL}/serveur/join/{bar.code_invitation}/" if hasattr(settings, 'SITE_URL') else f"https://barpilote.com/join/{bar.code_invitation}/"
        qr = qrcode.make(invite_url)
        qr_io = io.BytesIO()
        qr.save(qr_io, format='PNG')
        qr_io.seek(0)
        c.drawImage(ImageReader(qr_io), width/2 - qr_size/2, inner_y, width=qr_size, height=qr_size)
        
        inner_y -= 12*mm
        c.setFillColor(gray_muted)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(width/2, inner_y, "ZONE DE SERVICE ACTIVE")
        inner_y -= 6*mm
        c.drawCentredString(width/2, inner_y, "LIEN D'INVITATION")
        inner_y -= 5*mm
        c.setFillColor(orange_primary)
        c.setFont("Helvetica", 7)
        c.drawCentredString(width/2, inner_y, invite_url.replace("https://", "").replace("http://", ""))

        inner_y -= 8*mm
        c.setFillColor(gray_muted)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(width/2, inner_y, "CODE À SAISIR")
        inner_y -= 5*mm
        c.setFillColor(dark_text)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(width/2, inner_y, str(bar.code_invitation))

        # 3. SECTION COMMENT ÇA MARCHE
        footer_y = 30*mm
        footer_w = 110*mm
        c.setFillColor(orange_light)
        c.roundRect((width - footer_w)/2, footer_y, footer_w, 35*mm, 8*mm, stroke=0, fill=1)
        
        c.setFillColor(orange_primary)
        c.setFont("Helvetica-Bold", 11)
        c.drawString((width - footer_w)/2 + 15*mm, footer_y + 25*mm, "Comment ça marche ?")
        
        c.setFillColor(HexColor("#92400E"))
        c.setFont("Helvetica", 9)
        txt = "Vos serveurs scannent ce badge avec leur téléphone."
        c.drawString((width - footer_w)/2 + 15*mm, footer_y + 18*mm, txt)
        txt2 = "Ils sont automatiquement rattachés à votre stock, vos"
        c.drawString((width - footer_w)/2 + 15*mm, footer_y + 13*mm, txt2)
        txt3 = "tables et votre système de commandes BarPilote."
        c.drawString((width - footer_w)/2 + 15*mm, footer_y + 8*mm, txt3)

        c.showPage()
        c.save()
        
        buffer.seek(0)
        filename = f"Invitation_Staff_{bar.nom.replace(' ', '_')}.pdf"
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def generate_zip_response(self, tables):
        byte_data = io.BytesIO()
        with zipfile.ZipFile(byte_data, 'w') as zip_file:
            for table in tables:
                buffer = io.BytesIO()
                self.draw_badge(buffer, table)
                zip_file.writestr(f"{table.nom.replace(' ', '_')}_Badge.pdf", buffer.getvalue())
        
        byte_data.seek(0)
        response = HttpResponse(byte_data.read(), content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="Badges_QR_Tables.zip"'
        return response

class MixedCaseArrivalView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/mixed_case_arrival.html'

    def get_context_data(self, **kwargs):
        from django.db.models import Q
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        bar = profile.bar
        if bar:
            # On ne liste que les SODAS (Soft Drinks / Sucreries) pour les casiers mixtes
            soda_filter = Q(produit__categorie__nom__icontains='Soft') | \
                          Q(produit__categorie__nom__icontains='Soda') | \
                          Q(produit__categorie__nom__icontains='Sucrerie')
            
            context['items_petits'] = StockItem.objects.filter(
                soda_filter,
                bar=bar, 
                produit__format_casier='PETIT'
            ).select_related('produit')
            
            context['items_gros'] = StockItem.objects.filter(
                soda_filter,
                bar=bar, 
                produit__format_casier='GROS'
            ).select_related('produit')
            
            context['bar'] = bar
        return context

    def post(self, request, *args, **kwargs):
        from django.contrib import messages
        from decimal import Decimal
        profile = PilotProfile.objects.get(user=request.user)
        bar = profile.bar
        
        format_type = request.POST.get('format_type') # PETIT or GROS
        devise = request.POST.get('devise', 'CDF')
        prix_casier = Decimal(request.POST.get('prix_casier', 0) or 0)
        nb_casiers = Decimal(request.POST.get('nb_casiers', 1) or 1)
        taille_casier = int(request.POST.get('taille_casier', 24) or 24)
        
        total_bouteilles_attendues = int(nb_casiers * Decimal(taille_casier))
        
        # Récupération des répartitions et réglages
        items_updates = []
        total_bouteilles_saisies = 0
        
        for key, value in request.POST.items():
            if key.startswith('qty_item_'):
                item_id = key.replace('qty_item_', '')
                qty = int(value or 0)
                if qty > 0:
                    # On récupère aussi le prix de vente et le seuil pour cet item
                    prix_vente = Decimal(request.POST.get(f'price_item_{item_id}', 0) or 0)
                    seuil = int(request.POST.get(f'alert_item_{item_id}', 10) or 10)
                    
                    items_updates.append({
                        'id': item_id, 
                        'qty': qty,
                        'prix_vente': prix_vente,
                        'seuil': seuil
                    })
                    total_bouteilles_saisies += qty
        
        if total_bouteilles_saisies != total_bouteilles_attendues:
            messages.error(request, f"Erreur : Vous avez saisi {total_bouteilles_saisies} bouteilles au lieu de {total_bouteilles_attendues} ({nb_casiers} casiers de {taille_casier}).")
            return self.get(request, *args, **kwargs)
            
        # Calcul du prix unitaire moyen pour cet arrivage
        if taille_casier > 0:
            prix_unitaire = prix_casier / Decimal(taille_casier)
        else:
            prix_unitaire = 0
        
        for update in items_updates:
            item = StockItem.objects.get(id=update['id'], bar=bar)
            item.quantite_actuelle += update['qty']
            
            # Mise à jour complète
            item.devise = devise
            item.prix_achat_casier = prix_casier
            item.prix_achat_unitaire = prix_unitaire
            item.prix_vente_unitaire = update['prix_vente']
            item.seuil_alerte = update['seuil']
            item.save()
            
        messages.success(request, f"Arrivage de {nb_casiers} casiers enregistré ! {total_bouteilles_saisies} bouteilles mises à jour.")
        return redirect('inventory_html')

class ToggleCurrencyView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        profile = PilotProfile.objects.get(user=request.user)
        profile.preferred_currency = 'CDF' if profile.preferred_currency == 'USD' else 'USD'
        profile.save(update_fields=['preferred_currency'])
        return JsonResponse({
            'currency': profile.preferred_currency,
            'exchange_rate': float(profile.bar.taux_change_usd_to_cdf or 2800) if profile.bar else 2800,
        })

class LiveOrdersAPIView(LoginRequiredMixin, View):
    """API pour récupérer les commandes actives (En attente / En préparation) pour le dashboard propriétaire"""
    def get(self, request, *args, **kwargs):
        try:
            profile = PilotProfile.objects.get(user=request.user)
            bar = profile.bar
            if not bar:
                return JsonResponse({'orders': []})
                
            active_orders = Order.objects.filter(
                bar=bar, 
                statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED']
            ).order_by('date_creation')
            
            orders_data = []
            for order in active_orders:
                items_data = []
                for item in order.items.all():
                    items_data.append({
                        'id': str(item.product_item_id),
                        'name': item.product_item.produit.nom,
                        'qty': item.quantite,
                        'price': float(item.prix_unitaire),
                        'unit': item.unite_vente,
                        'devise': item.devise
                    })

                orders_data.append({
                    'id': str(order.id),
                    'table_nom': order.table.nom,
                    'statut': order.statut,
                    'items_count': order.items.count(),
                    'total_usd': float(order.total_usd),
                    'total_cdf': float(order.total_cdf),
                    'timestamp': order.date_creation.timestamp(),
                    'date_creation': order.date_creation.isoformat(),
                    'date_service': order.date_service.isoformat() if order.date_service else None,
                    'delivery_duration': int((order.date_service - order.date_creation).total_seconds()) if order.date_service else None,
                    'items': items_data
                })
                
            # Last paid order details for dynamic cashing timer
            last_paid_order = Order.objects.filter(
                bar=bar,
                statut='PAID'
            ).order_by('-date_maj').first()
            last_paid_timestamp = int(last_paid_order.date_maj.timestamp()) if last_paid_order else None
            
            return JsonResponse({
                'orders': orders_data,
                'last_paid_timestamp': last_paid_timestamp
            })
        except PilotProfile.DoesNotExist:
            return JsonResponse({'error': 'Profile not found'}, status=404)

class UpdateOrderStatusView(LoginRequiredMixin, View):
    """API pour mettre à jour le statut d'une commande via AJAX"""
    def post(self, request, *args, **kwargs):
        try:
            profile = PilotProfile.objects.get(user=request.user)
            order_ids_raw = request.POST.get('order_id')
            new_status = request.POST.get('status')
            
            client_name = request.POST.get('client_name')
            client_phone = request.POST.get('client_phone')
            
            if not order_ids_raw or not new_status:
                return JsonResponse({'error': 'Missing parameters'}, status=400)
                
            order_ids = [oid.strip() for oid in order_ids_raw.split(',') if oid.strip()]
            
            orders = Order.objects.filter(id__in=order_ids, bar=profile.bar)
            
            for order in orders:
                order.statut = new_status
                if new_status == 'SERVED':
                    order.date_service = timezone.now()
                if client_name:
                    order.client_name = client_name
                if client_phone:
                    order.client_phone = client_phone
                order.save()
            
            # Auto-generate Facture if PAID
            if new_status == 'PAID' and orders.exists():
                deferred = request.POST.get('deferred') == 'true'
                guarantor = request.POST.get('guarantor', '').strip()
                
                total_usd = sum(order.total_usd for order in orders)
                total_cdf = sum(order.total_cdf for order in orders)
                table_nom = orders.first().table.nom if orders.first().table else "Comptoir"
                
                # Format du nom du client
                if client_name and client_phone:
                    client_nom_complet = f"{client_name} ({client_phone})"
                elif client_name:
                    client_nom_complet = client_name
                elif client_phone:
                    client_nom_complet = f"Client {client_phone}"
                else:
                    client_nom_complet = f"Client - {table_nom}"
                
                # Générer un numéro de facture unique court (ex: FAC-260517-A1B2)
                short_uuid = str(uuid.uuid4())[:4].upper()
                date_str = timezone.now().strftime("%y%m%d")
                numero_facture = f"FAC-{date_str}-{short_uuid}"
                
                facture_status = 'IMPAYEE' if deferred else 'PAYEE'
                
                notes_lines = [f"Paiement différé (Dette) de {orders.count()} commande(s) pour la {table_nom}" if deferred else f"Paiement de {orders.count()} commande(s) pour la {table_nom}"]
                guaranteed_by = None
                if deferred and guarantor:
                    guarantor_label = "Propriétaire" if guarantor == 'proprietaire' else "Serveur"
                    notes_lines.append(f"Garant: {guarantor_label}")
                    guaranteed_by = profile
                
                facture = Facture.objects.create(
                    bar=profile.bar,
                    numero=numero_facture,
                    client_fournisseur=client_nom_complet,
                    montant_usd=total_usd,
                    montant_cdf=total_cdf,
                    type_facture='CLIENT',
                    statut=facture_status,
                    guaranteed_by=guaranteed_by,
                    notes="\n".join(notes_lines)
                )
                facture.orders.set(orders)
                if facture.statut == 'IMPAYEE':
                    notify_debt_created(facture, actor=request.user)

            for order in orders:
                notify_order_status(order, actor=request.user, status_label=order.get_statut_display())
            
            return JsonResponse({'success': True, 'new_status': new_status})
        except PilotProfile.DoesNotExist:
            return JsonResponse({'error': 'Profile not found'}, status=404)

def draw_facture_page(c, facture, profile):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    import os
    from django.conf import settings
    
    width, height = A4 # 595.27 x 841.89
    
    # Palette de couleurs élégante et chaleureuse (Orange premium de la marque BarPilote)
    color_primary = HexColor("#EA580C") # Orange vif de BarPilote
    color_secondary = HexColor("#F97316") # Orange secondaire
    color_dark = HexColor("#1F2937")
    color_light = HexColor("#FFF7ED") # Teinte orange très claire/douce pour les fonds
    color_gray = HexColor("#6B7280")
    
    # Elegant orange accent top line (3mm thickness)
    c.setFillColor(color_primary)
    c.rect(0, height - 3*mm, width, 3*mm, stroke=0, fill=1)
    
    # Paths for logos
    logo_bp_path = os.path.join(settings.BASE_DIR, 'static', 'logo_orange.png')
    if not os.path.exists(logo_bp_path):
        logo_bp_path = os.path.join(settings.BASE_DIR, 'static', 'logo.png')
        
    logo_est_path = None
    if profile.bar and profile.bar.logo:
        try:
            if os.path.exists(profile.bar.logo.path):
                logo_est_path = profile.bar.logo.path
        except Exception:
            pass
            
    # 1. En-tête (Logos & Infos Bar)
    # A. Draw Establishment (Left Side)
    if logo_est_path:
        c.drawImage(logo_est_path, 20*mm, height - 28*mm, width=18*mm, height=18*mm, mask='auto')
        c.setFillColor(color_dark)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(42*mm, height - 19*mm, profile.bar.nom.upper())
        
        c.setFont("Helvetica", 9)
        c.setFillColor(color_gray)
        c.drawString(42*mm, height - 25*mm, f"Tél: {profile.telephone or 'N/A'} | Email: {profile.user.email or 'N/A'}")
    else:
        c.setFillColor(color_dark)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(20*mm, height - 19*mm, profile.bar.nom.upper())
        
        c.setFont("Helvetica", 9)
        c.setFillColor(color_gray)
        c.drawString(20*mm, height - 25*mm, f"Tél: {profile.telephone or 'N/A'} | Email: {profile.user.email or 'N/A'}")
        
    # B. Draw BarPilote Branding (Right Side)
    if os.path.exists(logo_bp_path):
        c.drawImage(logo_bp_path, width - 38*mm, height - 28*mm, width=18*mm, height=18*mm, mask='auto')
        c.setFillColor(color_primary)
        c.setFont("Helvetica-Bold", 14)
        c.drawRightString(width - 42*mm, height - 19*mm, "FACTURE")
        
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(color_dark)
        c.drawRightString(width - 42*mm, height - 25*mm, f"N° : {facture.numero}")
    else:
        c.setFillColor(color_primary)
        c.setFont("Helvetica-Bold", 16)
        c.drawRightString(width - 20*mm, height - 19*mm, "FACTURE")
        
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(color_dark)
        c.drawRightString(width - 20*mm, height - 25*mm, f"N° : {facture.numero}")
        
    # Beautiful thin orange separation line below header
    c.setStrokeColor(color_primary)
    c.setLineWidth(1)
    c.line(20*mm, height - 35*mm, width - 20*mm, height - 35*mm)
    
    # 2. Infos Client & Facture (Double colonnes)
    y = height - 48*mm
    c.setFillColor(color_dark)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20*mm, y, "FACTURÉ À :")
    c.drawRightString(width - 20*mm, y, "DÉTAILS DE FACTURATION :")
    
    y -= 6*mm
    c.setFont("Helvetica", 9)
    c.setFillColor(color_dark)
    c.drawString(20*mm, y, facture.client_fournisseur)
    c.drawRightString(width - 20*mm, y, f"Date d'émission : {facture.date_emission.strftime('%d/%m/%Y %H:%M')}")
    
    y -= 5*mm
    c.drawString(20*mm, y, "Client BarPilote")
    c.drawRightString(width - 20*mm, y, f"Statut : {facture.get_statut_display().upper()}")
    
    # 3. Ligne de séparation
    y -= 8*mm
    c.setStrokeColor(HexColor("#E5E7EB"))
    c.setLineWidth(1)
    c.line(20*mm, y, width - 20*mm, y)
    
    # 4. Table des articles
    y -= 10*mm
    c.setFillColor(color_primary)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20*mm, y, "Description du produit")
    c.drawRightString(width - 80*mm, y, "Quantité")
    c.drawRightString(width - 50*mm, y, "Prix Unitaire")
    c.drawRightString(width - 20*mm, y, "Total")
    
    # Ligne d'en-tête de table
    y -= 3*mm
    c.setStrokeColor(color_primary)
    c.setLineWidth(1.5)
    c.line(20*mm, y, width - 20*mm, y)
    
    # Récupération et agrégation des items de la facture
    items = {}
    for order in facture.orders.all():
        for order_item in order.items.all():
            name = order_item.product_item.produit.nom
            qty = order_item.quantite
            price = float(order_item.prix_unitaire)
            devise = order_item.devise
            key = (name, price, devise)
            if key in items:
                items[key] += qty
            else:
                items[key] = qty
                
    # Affichage des lignes
    y -= 6*mm
    c.setFillColor(color_dark)
    c.setFont("Helvetica", 10)
    c.setStrokeColor(HexColor("#E5E7EB"))
    c.setLineWidth(0.5)
    
    for (name, price, devise), qty in items.items():
        total_item = price * qty
        price_display = f"{price:.2f} $" if devise == 'USD' else f"{price:,.0f} FC"
        total_display = f"{total_item:.2f} $" if devise == 'USD' else f"{total_item:,.0f} FC"
        
        c.drawString(20*mm, y, name)
        c.drawRightString(width - 80*mm, y, str(qty))
        c.drawRightString(width - 50*mm, y, price_display)
        c.drawRightString(width - 20*mm, y, total_display)
        
        y -= 4*mm
        c.line(20*mm, y, width - 20*mm, y)
        y -= 4*mm
        
        # Gestion bas de page basique
        if y < 40*mm:
            c.showPage()
            y = height - 20*mm
            c.setFillColor(color_dark)
            c.setFont("Helvetica", 10)
            
    # 5. Totaux (Encadré à droite)
    y -= 10*mm
    c.setFillColor(color_light)
    c.rect(width - 90*mm, y - 25*mm, 70*mm, 25*mm, stroke=0, fill=1)
    
    c.setFillColor(color_dark)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(width - 85*mm, y - 7*mm, "TOTAL USD :")
    c.drawRightString(width - 25*mm, y - 7*mm, f"{facture.montant_usd:.2f} $")
    
    c.drawString(width - 85*mm, y - 17*mm, "TOTAL CDF :")
    c.drawRightString(width - 25*mm, y - 17*mm, f"{facture.montant_cdf:,.0f} FC")
    
    # 6. Conditions & Merci (Pied de page)
    c.setFillColor(color_gray)
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(width/2, 25*mm, "Merci pour votre confiance ! À bientôt chez nous.")
    
    c.setFont("Helvetica", 8)
    c.drawCentredString(width/2, 18*mm, f"Facture émise électroniquement par le système de gestion BarPilote.")
    
    c.showPage()

class DownloadFacturePDFView(LoginRequiredMixin, View):
    def get(self, request, facture_id, *args, **kwargs):
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        
        profile = get_object_or_404(PilotProfile, user=request.user)
        facture = get_object_or_404(Facture, id=facture_id, bar=profile.bar)
        
        response = HttpResponse(content_type='application/pdf')
        
        # Nom du fichier : date_emission_nom_du_client.pdf
        date_str = facture.date_emission.strftime("%Y%m%d")
        client_clean = "".join(c if c.isalnum() else "_" for c in facture.client_fournisseur).strip("_")
        client_clean = client_clean[:30]
        filename = f"Facture_{date_str}_{client_clean}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        draw_facture_page(c, facture, profile)
        c.save()
        
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response

class DownloadAllFacturesView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        
        profile = get_object_or_404(PilotProfile, user=request.user)
        factures = Facture.objects.filter(bar=profile.bar).order_by('-date_emission')
        
        if not factures.exists():
            from django.contrib import messages
            messages.warning(request, "Aucune facture à télécharger.")
            return redirect('finance_html')
            
        response = HttpResponse(content_type='application/pdf')
        
        bar_name_clean = "".join(c if c.isalnum() else "_" for c in profile.bar.nom).strip("_")
        response['Content-Disposition'] = f'attachment; filename="Factures_Completes_{bar_name_clean}.pdf"'
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        
        # Dessiner chaque facture l'une après l'autre
        for facture in factures:
            draw_facture_page(c, facture, profile)
            
        c.save()
        
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response

class ClientHistoryAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        from django.db.models import Q, Sum
        phone = request.GET.get('phone', '').strip()
        name = request.GET.get('name', '').strip()
        profile = get_object_or_404(PilotProfile, user=request.user)
        bar = profile.bar
        
        if not phone and not name:
            return JsonResponse({'total_spent_cdf': 0, 'eligible': False})
            
        # Check if client exists and is explicitly whitelisted
        client_query = Q(bar=bar)
        client_sub = Q()
        if phone:
            client_sub |= Q(telephone__contains=phone)
        if name:
            client_sub |= Q(nom__icontains=name)
            
        client = Client.objects.filter(client_query & client_sub).first()
        is_manually_authorized = client.dette_autorisee if client else False
            
        query = Q(bar=bar, type_facture='CLIENT', statut='PAYEE')
        sub_query = Q()
        if phone:
            sub_query |= Q(client_fournisseur__contains=phone)
        if name:
            sub_query |= Q(client_fournisseur__icontains=name)
            
        factures = Facture.objects.filter(query & sub_query)
        
        total_usd = factures.aggregate(Sum('montant_usd'))['montant_usd__sum'] or 0
        total_cdf = factures.aggregate(Sum('montant_cdf'))['montant_cdf__sum'] or 0
        
        rate = bar.taux_change_usd_to_cdf or 2800
        total_spent_cdf = float(total_cdf) + float(total_usd) * float(rate)
        
        # Eligible if manually authorized OR spent >= seuil_dette_eligible FC
        eligible = is_manually_authorized or (total_spent_cdf >= float(bar.seuil_dette_eligible))
        
        return JsonResponse({
            'total_spent_cdf': total_spent_cdf,
            'eligible': eligible,
            'is_manually_authorized': is_manually_authorized,
            'currency_rate': float(rate),
            'client_found': client is not None,
            'client_nom': client.nom if client else '',
            'client_telephone': client.telephone if client else '',
            'seuil_dette_eligible': float(bar.seuil_dette_eligible),
        })

class ClientManagementView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        profile = get_object_or_404(PilotProfile, user=request.user)
        bar = profile.bar
        clients = Client.objects.filter(bar=bar)
        
        # Build list of clients with their real total spent and credit status
        clients_data = []
        rate = bar.taux_change_usd_to_cdf or 2800
        
        for c in clients:
            # Query paid factures matching this client's name or phone
            query = Q(bar=bar, type_facture='CLIENT', statut='PAYEE')
            sub_query = Q()
            if c.telephone:
                sub_query |= Q(client_fournisseur__contains=c.telephone)
            sub_query |= Q(client_fournisseur__icontains=c.nom)
            
            factures = Facture.objects.filter(query & sub_query)
            
            total_usd = sum(f.montant_usd for f in factures)
            total_cdf = sum(f.montant_cdf for f in factures)
            total_spent_cdf = float(total_cdf) + float(total_usd) * float(rate)
            
            eligible = c.dette_autorisee or (total_spent_cdf >= float(bar.seuil_dette_eligible))
            
            clients_data.append({
                'id': c.id,
                'nom': c.nom,
                'telephone': c.telephone or 'Non renseigné',
                'dette_autorisee': c.dette_autorisee,
                'total_spent_cdf': total_spent_cdf,
                'eligible': eligible,
            })
            
        context = {
            'profile': profile,
            'bar': bar,
            'clients': clients_data,
            'pref_currency': request.session.get('pref_currency', 'USD'),
        }
        return render(request, 'proprietaire/clients.html', context)
        
    def post(self, request, *args, **kwargs):
        profile = get_object_or_404(PilotProfile, user=request.user)
        bar = profile.bar
        
        action = request.POST.get('action')
        
        if action == 'add':
            nom = request.POST.get('nom', '').strip()
            telephone = request.POST.get('telephone', '').strip()
            dette_autorisee = request.POST.get('dette_autorisee') == 'on'
            
            if not nom:
                return redirect('clients_html')
                
            Client.objects.create(
                bar=bar,
                nom=nom,
                telephone=telephone if telephone else None,
                dette_autorisee=dette_autorisee
            )
            return redirect('clients_html')
            
        elif action == 'toggle_debt':
            client_id = request.POST.get('client_id')
            client = get_object_or_404(Client, id=client_id, bar=bar)
            client.dette_autorisee = not client.dette_autorisee
            client.save()
            return JsonResponse({'success': True, 'dette_autorisee': client.dette_autorisee})
            
        elif action == 'delete':
            client_id = request.POST.get('client_id')
            client = get_object_or_404(Client, id=client_id, bar=bar)
            client_name = client.nom
            is_whitelisted = client.dette_autorisee
            client.delete()
            payload = {
                'success': True,
                'message': f'Client {client_name} retiré.',
                'remove_selectors': [f'#client-row-{client_id}'],
                'text_updates': {
                    '#clientsTotalCount': str(Client.objects.filter(bar=bar).count()),
                },
                'dispatch_event': {
                    'type': 'barpilote:clients-changed',
                    'detail': {'client_id': str(client_id), 'action': 'delete'},
                },
            }
            if is_whitelisted:
                payload['text_updates']['#statWhitelistedCount'] = str(max(0, Client.objects.filter(bar=bar, dette_autorisee=True).count()))
            live_response = _live_payload(request, payload)
            if live_response is not None:
                return live_response
            return redirect('clients_html')
            
        elif action == 'update_threshold':
            threshold_val = request.POST.get('seuil_dette_eligible', '').strip()
            if threshold_val:
                try:
                    from decimal import Decimal
                    # Clean commas or spaces if entered
                    threshold_val = threshold_val.replace(' ', '').replace(',', '')
                    bar.seuil_dette_eligible = Decimal(threshold_val)
                    bar.save()
                except Exception as e:
                    pass
            return redirect('clients_html')
            
        return redirect('clients_html')


class FCMConfigAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        return JsonResponse({
            'apiKey': settings.FCM_WEB_API_KEY,
            'authDomain': settings.FCM_WEB_AUTH_DOMAIN,
            'projectId': settings.FCM_WEB_PROJECT_ID,
            'storageBucket': settings.FCM_WEB_STORAGE_BUCKET,
            'messagingSenderId': settings.FCM_WEB_MESSAGING_SENDER_ID,
            'appId': settings.FCM_WEB_APP_ID,
            'vapidKey': settings.FCM_WEB_VAPID_KEY,
        })


class FCMTokenAPIView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        try:
            payload = json.loads(request.body.decode() or '{}')
        except json.JSONDecodeError:
            payload = request.POST
        token = (payload.get('token') or '').strip()
        if not token:
            return JsonResponse({'error': 'Token FCM manquant.'}, status=400)
        from .models import FCMDeviceToken
        device, _ = FCMDeviceToken.objects.update_or_create(
            token=token,
            defaults={
                'user': request.user,
                'platform': payload.get('platform') or 'web',
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:1000],
                'is_active': True,
            },
        )
        return JsonResponse({'success': True, 'device_id': str(device.id)})

    def delete(self, request, *args, **kwargs):
        try:
            payload = json.loads(request.body.decode() or '{}')
        except json.JSONDecodeError:
            payload = {}
        token = (payload.get('token') or '').strip()
        if token:
            from .models import FCMDeviceToken
            FCMDeviceToken.objects.filter(user=request.user, token=token).update(is_active=False)
        return JsonResponse({'success': True})


class FirebaseMessagingServiceWorkerView(View):
    def get(self, request, *args, **kwargs):
        config = {
            'apiKey': settings.FCM_WEB_API_KEY,
            'authDomain': settings.FCM_WEB_AUTH_DOMAIN,
            'projectId': settings.FCM_WEB_PROJECT_ID,
            'storageBucket': settings.FCM_WEB_STORAGE_BUCKET,
            'messagingSenderId': settings.FCM_WEB_MESSAGING_SENDER_ID,
            'appId': settings.FCM_WEB_APP_ID,
        }
        script = f"""
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({json.dumps(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {{
  const title = payload.notification?.title || payload.data?.title || 'BarPilote';
  const options = {{
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/static/logo_orange.png',
    badge: '/static/logo_orange.png',
    data: payload.data || {{}},
  }};
  self.registration.showNotification(title, options);
}});

self.addEventListener('notificationclick', (event) => {{
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
}});
"""
        return HttpResponse(script, content_type='application/javascript')
