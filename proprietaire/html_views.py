from django.views.generic import TemplateView, View
from django.shortcuts import render, redirect
import os
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Sum, Q, Count, F
from django.utils import timezone
from datetime import timedelta
from django.http import HttpResponse, FileResponse
from django.conf import settings
import qrcode
import io
import zipfile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from .models import PilotProfile, Order, Table, Bar, StockItem, OrderItem, Category

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
                
                # Active Tables (tables with pending/preparing orders)
                active_tables_ids = Order.objects.filter(
                    bar=bar, 
                    statut__in=['PENDING', 'PREPARING']
                ).values_list('table_id', flat=True).distinct()
                
                context['tables_actives'] = active_tables_ids.count()
                total_tables = Table.objects.filter(bar=bar).count()
                context['tables_capacity_percent'] = int((context['tables_actives'] / total_tables) * 100) if total_tables > 0 else 0
                
                # Orders in flight
                context['active_orders'] = Order.objects.filter(
                    bar=bar, 
                    statut__in=['PENDING', 'PREPARING']
                ).count()
                
                # Recent Transactions (last 10 orders)
                context['recent_orders'] = Order.objects.filter(bar=bar).order_by('-date_creation')[:10]
                
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
        
        if name:
            # Create the bar
            new_bar = Bar.objects.create(
                nom=name, 
                adresse=address,
                type_etablissement=bar_type
            )
            
            if 'logo' in request.FILES:
                new_bar.logo = request.FILES['logo']
            
            new_bar.save()
            
            # Link to profile
            profile = PilotProfile.objects.get(user=request.user)
            profile.bar = new_bar
            profile.save()
            
            # Nettoyage session
            if 'setup_bar_type' in request.session:
                del request.session['setup_bar_type']
                
            return redirect('table_setup')
            
        return self.get(request, *args, **kwargs)

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
            # Create N tables
            for i in range(1, count + 1):
                Table.objects.create(
                    bar=profile.bar,
                    nom=f"Table {i}",
                    est_active=True
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
        
        item.save()
        messages.success(request, f"Configuration de {item.produit.nom} mise à jour !")
        return redirect('inventory_html')

class FinanceView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/finance.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        bar = profile.bar
        
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
        
        # Panier moyen (en USD pour l'exemple)
        if context['total_orders'] > 0:
            context['avg_basket_usd'] = context['revenue_usd'] / context['total_orders']
        else:
            context['avg_basket_usd'] = 0
            
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
        
        # Pour le modal d'enregistrement de perte
        context['inventory_items'] = StockItem.objects.filter(bar=bar).select_related('produit')
        
        return context

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
            quantite=quantite,
            raison=raison,
            commentaire=commentaire
        )
        
        # Déduire du stock
        item.quantite_actuelle = max(0, item.quantite_actuelle - quantite)
        item.save()
        
        messages.success(request, f"Perte de {quantite} x {item.produit.nom} enregistrée. Stock mis à jour.")
        
        if profile.role == 'SERVEUR':
            return redirect('serveur_dashboard')
        return redirect('finance_html')

class TeamView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/team.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        if profile.bar:
            context['staff'] = PilotProfile.objects.filter(bar=profile.bar).exclude(role='PROPRIETAIRE')
        return context

class TablesView(LoginRequiredMixin, TemplateView):
    template_name = 'proprietaire/tables.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile = PilotProfile.objects.get(user=self.request.user)
        if profile.bar:
            context['tables'] = Table.objects.filter(bar=profile.bar).order_by('nom')
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
        action = request.POST.get('action')
        table_id = request.POST.get('table_id')
        
        if action == 'rename' and table_id:
            new_name = request.POST.get('name')
            if new_name:
                table = Table.objects.get(id=table_id, bar__proprietaires__user=request.user)
                table.nom = new_name
                table.save()
        
        elif action == 'add':
            count = request.POST.get('count', 0)
            try:
                count = int(count)
            except ValueError:
                count = 0
                
            profile = PilotProfile.objects.get(user=request.user)
            if profile.bar and count > 0:
                # Trouver le numéro max actuel de manière robuste
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
                
                for i in range(start_index, start_index + count):
                    Table.objects.create(
                        bar=profile.bar,
                        nom=f"Table {i}",
                        est_active=True
                    )
        
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
        qr_url = f"{settings.SITE_URL}/serveur/table/{table.id}/" if hasattr(settings, 'SITE_URL') else f"https://barpilote.com/table/{table.id}/"
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
        display_url = qr_url.replace("https://", "").replace("http://", "").split('/')[0]
        full_path = qr_url.split(display_url)[1] if len(qr_url.split(display_url)) > 1 else ""
        
        # On affiche juste la partie importante de l'URL si trop longue
        c.drawCentredString(width/2, y_footer, f"{display_url}{full_path[:20]}...") 
        
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
