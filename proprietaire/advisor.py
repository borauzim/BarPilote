from decimal import Decimal
import json
import re
import unicodedata

import requests
from django.conf import settings
from django.db.models import Count, F, Sum, DecimalField
from django.utils import timezone

from .models import BarAdvisorSettings, Facture, Order, OrderItem, Perte, PilotProfile, StockItem, Table


def _normalize(text):
    value = unicodedata.normalize('NFKD', text or '')
    value = ''.join(char for char in value if not unicodedata.combining(char))
    return value.lower()


def _tokens(text):
    return re.findall(r"[\w]+", _normalize(text), flags=re.UNICODE)


SOCIAL_WORDS = {
    # Francais / anglais
    'salut', 'bonjour', 'bonsoir', 'hello', 'hi', 'hey', 'yo', 'wesh', 'cc', 'coucou',
    'merci', 'thanks', 'thank', 'ok', 'okay', 'daccord', 'super', 'cool', 'mec', 'frere', 'chef',
    # Lingala
    'mbote', 'matondo', 'malamu', 'ndeko', 'sango',
    # Swahili
    'jambo', 'habari', 'asante', 'sawa', 'poa', 'rafiki',
    # Kikongo / Tshiluba
    'mbote', 'bote', 'tuasakidila', 'moyo', 'tshibawu', 'muoyo',
    # Espagnol / portugais
    'hola', 'buenos', 'buenas', 'gracias', 'vale', 'obrigado', 'obrigada', 'oi', 'ola',
    # Arabe translittere / russe translittere / mandarin pinyin
    'salam', 'marhaba', 'shukran', 'spasibo', 'privet', 'nihao', 'xiexie',
    # Scripts natifs courants
    'مرحبا', 'سلام', 'شكرا', 'привет', 'спасибо', '你好', '谢谢',
}

THANK_WORDS = {'merci', 'thanks', 'thank', 'matondo', 'asante', 'gracias', 'obrigado', 'obrigada', 'shukran', 'شكرا', 'spasibo', 'спасибо', 'xiexie', '谢谢'}

HELP_PHRASES = [
    'qui es tu', 'tu es qui', 'c est quoi ton role', 'ton role', 'que peux tu faire', 'tu peux faire quoi',
    'aide moi', 'help', 'help me', 'what can you do', 'who are you',
    'sunga ngai', 'nini unaweza kufanya', 'ayuda', 'ajuda', 'مساعدة', 'помоги', '你能做什么',
]

INSULT_WORDS = {
    'enfoire', 'connard', 'imbecile', 'idiot', 'nul', 'merde', 'stupid', 'fuck', 'idiota',
    'burro', 'maluco', 'pendejo', 'мудак', 'дурак', 'идиот', 'غبي', 'أحمق', '笨蛋',
}

FOLLOW_UP_PHRASES = {
    'comment ca', 'comment sa', 'cmt ca', 'cmt sa', 'pourquoi', 'explique', 'explique moi',
    'what do you mean', 'why', 'explain', 'how', 'como', 'por que', 'porque', 'explica',
    'kwa nini', 'eleza', 'limbola', 'почему', 'объясни', 'لماذا', 'اشرح', '为什么', '解释',
}

YES_NO_WORDS = {'oui', 'non', 'ok', 'okay', 'daccord', 'yes', 'no', 'si', 'sim', 'nao', 'não', 'sawa', 'ndiyo', 'hapana', 'لا', 'نعم', 'да', 'нет', '是', '不是'}

STOCK_WORDS = {
    'stock', 'stocks', 'rupture', 'reserve', 'inventaire', 'reassort', 'approvisionnement',
    'inventory', 'supply', 'restock', 'outofstock', 'existencias', 'inventario', 'estoque',
    'bidhaa', 'mzigo', 'المخزون', 'запас', '库存',
}
SALES_WORDS = {
    'vente', 'ventes', 'revenu', 'revenus', 'recette', 'recettes', 'chiffre', 'panier', 'marge', 'prix', 'benefice', 'benefices', 'argent',
    'sales', 'revenue', 'income', 'profit', 'price', 'money', 'ventas', 'ingresos', 'ganancia', 'dinero',
    'vendas', 'receita', 'lucro', 'dinheiro', 'mauzo', 'mapato', 'faida', 'mbongo', 'etekelo',
    'المبيعات', 'الإيرادات', 'ربح', 'деньги', 'продажи', 'выручка', '收入', '销售', '利润',
}
TEAM_WORDS = {
    'serveur', 'serveurs', 'staff', 'equipe', 'performance', 'performances', 'individu', 'individus', 'rang', 'employe', 'employes',
    'waiter', 'server', 'team', 'employee', 'employees', 'ranking', 'personal', 'equipo', 'empleado', 'garcon',
    'garçom', 'equipa', 'funcionario', 'mhudumu', 'wafanyakazi', 'équipe', 'عامل', 'فريق', 'сотрудник', 'команда', '员工', '团队',
}
DEBT_WORDS = {
    'dette', 'dettes', 'payer', 'payees', 'impaye', 'impayes', 'facture', 'factures', 'credit', 'garant', 'creance',
    'debt', 'debts', 'unpaid', 'invoice', 'bill', 'credit', 'deuda', 'deudas', 'factura', 'pagar',
    'divida', 'dívida', 'conta', 'deni', 'madeni', 'nyongo', 'facture', 'دين', 'فاتورة', 'долг', 'счет', '债务', '账单',
}
SERVICE_WORDS = {
    'table', 'tables', 'service', 'priorite', 'priorites', 'commande', 'commandes', 'retard', 'livraison', 'servir',
    'order', 'orders', 'serve', 'priority', 'late', 'delivery', 'mesa', 'pedido', 'servicio', 'atraso',
    'mesa', 'pedido', 'servico', 'serviço', 'meza', 'agizo', 'maagizo', 'خدمة', 'طلب', 'طاولة', 'заказ', 'стол', '服务', '订单', '桌子',
}
LOSS_WORDS = {
    'perte', 'pertes', 'casse', 'vol', 'ecart', 'coullage', 'coulage',
    'loss', 'losses', 'breakage', 'theft', 'waste', 'perdida', 'perdidas', 'robo',
    'perda', 'roubo', 'hasara', 'wizi', 'خسارة', 'سرقة', 'потеря', 'кража', '损失', '盗窃',
}
ADVICE_PHRASES = [
    'comment ameliorer', 'que me conseille', 'donne moi des conseils', 'conseil general', 'amelioration etablissement', 'ameliorer etablissement',
    'how can i improve', 'give me advice', 'what do you recommend', 'como mejorar', 'dame consejos',
    'como melhorar', 'me da conselhos', 'jinsi ya kuboresha', 'nini nifanye', 'كيف احسن', 'что посоветуешь', 'как улучшить', '怎么改进',
]


def _has_any(tokens, words):
    return any(word in tokens for word in words)


def _matches(tokens, q, words):
    token_set = set(tokens)
    return any(word in token_set or word in q for word in words)


def _is_short_social_message(q, tokens):
    return bool(tokens) and len(tokens) <= 5 and all(token in SOCIAL_WORDS for token in tokens)


def _small_talk_response(profile, question, history=None):
    q = _normalize(question).strip()
    tokens = _tokens(question)
    first_name = (profile.prenom or profile.user.first_name or '').strip()
    name_part = f" {first_name}" if first_name else ''

    if not tokens:
        return "Je suis là. Posez-moi une question sur les ventes, stocks, dettes, tables, pertes ou performances."

    if _is_short_social_message(q, tokens):
        if _has_any(tokens, THANK_WORDS):
            return "Avec plaisir. Je reste disponible pour analyser les ventes, stocks, dettes ou performances."
        return f"Salut{name_part}. Je suis votre conseiller BarPilote. Demandez-moi par exemple: 'comment augmenter les recettes ?', 'quel stock surveiller ?', ou 'qui performe le mieux ?'."

    if any(phrase in q for phrase in HELP_PHRASES):
        if profile.role == 'PROPRIETAIRE':
            return "Je suis votre conseiller IA propriétaire. Je peux analyser les recettes, stocks, dettes, tables, pertes et performances des serveurs pour proposer des actions concrètes."
        return "Je suis votre conseiller IA serveur. Je peux vous aider à prioriser vos commandes, améliorer vos ventes, suivre vos dettes liées et surveiller les stocks critiques."

    if any(word in tokens for word in INSULT_WORDS):
        return "Je comprends que vous soyez contrarié. Je reste disponible pour répondre clairement: dites-moi ce qui ne va pas ou la question exacte à traiter."

    domain_words = STOCK_WORDS | SALES_WORDS | TEAM_WORDS | DEBT_WORDS | SERVICE_WORDS | LOSS_WORDS
    if any(phrase in q for phrase in FOLLOW_UP_PHRASES) and not _matches(tokens, q, domain_words):
        recent = _conversation_payload(history)
        last_assistant = next((item['text'] for item in reversed(recent) if item['role'] == 'assistant'), '')
        if last_assistant:
            return f"Je veux dire ceci: {last_assistant} Si ce n'est pas clair, précisez le point que vous voulez que j'explique."
        return "Je veux dire que je peux vous aider à analyser les commandes, ventes, dettes, stocks, tables et performances. Dites-moi le point à expliquer."

    if q in YES_NO_WORDS:
        return "Compris. Donnez-moi un objectif précis: recettes, stock, dette, table, équipe ou pertes."

    return None


def _unknown_intent_response(profile):
    if profile.role == 'PROPRIETAIRE':
        return "Je peux répondre localement sur l’établissement, mais il me manque une intention claire. Précisez si vous parlez des recettes, stocks, dettes, tables, pertes ou performances des serveurs."
    return "Je peux répondre localement sur votre service, mais il me manque une intention claire. Précisez si vous parlez de vos ventes, commandes, tables, dettes liées ou stocks."

def _money(usd=0, cdf=0):
    usd = Decimal(usd or 0)
    cdf = Decimal(cdf or 0)
    parts = []
    if usd:
        parts.append(f"{usd:.2f} $")
    if cdf:
        parts.append(f"{cdf:,.0f} FC")
    return ' + '.join(parts) if parts else '0 $'


def _decimal_to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def _money_payload(values):
    values = values or {}
    return {
        'usd': float(values.get('usd') or 0),
        'cdf': float(values.get('cdf') or 0),
    }


def _advisor_context_payload(ctx):
    payload = {
        'role': ctx['role'],
        'bar_name': ctx['bar'].nom if ctx.get('bar') else '',
        'today_orders': ctx.get('today_orders', 0),
        'active_orders': ctx.get('active_orders', 0),
        'active_tables': ctx.get('active_tables', 0),
        'tables_total': ctx.get('tables_total'),
        'revenue_today': _money_payload(ctx.get('revenue_today')),
        'revenue_30_days': {
            **_money_payload(ctx.get('revenue_30')),
            'orders_count': (ctx.get('revenue_30') or {}).get('count') or 0,
        },
        'avg_basket_usd': float(ctx.get('avg_basket_usd') or 0),
        'debt': {
            **_money_payload(ctx.get('debt')),
            'count': (ctx.get('debt') or {}).get('count') or 0,
        },
        'losses_30_days': {
            'count': (ctx.get('losses_30') or {}).get('count') or 0,
            'quantity': float((ctx.get('losses_30') or {}).get('qty') or 0),
        },
        'stock_alerts': [
            {
                'product': item.produit.nom,
                'quantity': float(item.quantite_actuelle or 0),
                'threshold': item.seuil_alerte,
                'currency': item.devise,
                'sale_price': float(item.prix_vente_unitaire or 0),
            }
            for item in ctx.get('stock_alerts', [])
        ],
        'top_products_30_days': [
            {
                'product': item['name'],
                'quantity_sold': int(item['qty'] or 0),
                'revenue': float(item['revenue'] or 0),
                'currency': item['devise'],
            }
            for item in ctx.get('top_products', [])
        ],
    }
    if ctx['role'] == 'PROPRIETAIRE':
        payload['staff_30_days'] = [
            {
                'name': item['name'],
                'paid_orders': item['count'],
                'revenue_usd': float(item['usd'] or 0),
                'revenue_cdf': float(item['cdf'] or 0),
            }
            for item in ctx.get('staff', [])
        ]
    else:
        payload['server_rank_30_days'] = ctx.get('rank')
        payload['team_size'] = ctx.get('team_size')
    return payload


def _advisor_instructions():
    return (
        "Tu es le conseiller IA BarPilote. Réponds à la question exacte de l'utilisateur, "
        "quelle que soit sa manière de parler: français familier, anglais, lingala, swahili, kikongo, tshiluba, "
        "espagnol, portugais, arabe, russe, mandarin, mélange de langues, fautes, argot ou phrases courtes. "
        "Réponds dans la langue principale de l'utilisateur quand tu la reconnais; sinon réponds en français simple. "
        "Ne force jamais une synthèse métier si l'utilisateur dit seulement bonjour, remercie, plaisante ou pose une question simple. "
        "Si la question concerne l'établissement, utilise uniquement les données fournies dans CONTEXTE_METIER pour les chiffres. "
        "Si une information n'est pas dans le contexte, dis-le clairement au lieu d'inventer. "
        "Donne une réponse précise, concise, naturelle, en français. "
        "Pour les conseils métier, donne des actions concrètes et priorisées. "
        "N'affiche pas de préfixe technique et ne mentionne pas JSON, modèle ou prompt."
    )


def _conversation_payload(history):
    cleaned = []
    for item in history or []:
        role = str(item.get('role') or '').strip().lower()
        text = str(item.get('text') or '').strip()
        if role in {'user', 'assistant'} and text:
            cleaned.append({'role': role, 'text': text[:600]})
    return cleaned[-8:]


def _advisor_user_input(ctx, question, history=None):
    return "\n\n".join([
        "CONTEXTE_METIER:",
        json.dumps(_advisor_context_payload(ctx), ensure_ascii=False, default=_decimal_to_float),
        "CONVERSATION_RECENTE:",
        json.dumps(_conversation_payload(history), ensure_ascii=False),
        "QUESTION_UTILISATEUR:",
        question,
    ])


def _call_gemini_advisor(ctx, question, history=None):
    api_key = getattr(settings, 'GEMINI_API_KEY', '')
    if not api_key:
        return None

    model = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
    try:
        response = requests.post(
            url,
            params={'key': api_key},
            headers={'Content-Type': 'application/json'},
            json={
                'systemInstruction': {
                    'parts': [{'text': _advisor_instructions()}],
                },
                'contents': [
                    {
                        'role': 'user',
                        'parts': [{'text': _advisor_user_input(ctx, question, history)}],
                    }
                ],
                'generationConfig': {
                    'temperature': 0.4,
                    'maxOutputTokens': 700,
                },
            },
            timeout=getattr(settings, 'GEMINI_REQUEST_TIMEOUT', 20),
        )
        response.raise_for_status()
        data = response.json()
        for candidate in data.get('candidates', []):
            parts = candidate.get('content', {}).get('parts', [])
            answer = ''.join(part.get('text', '') for part in parts).strip()
            if answer:
                return answer
    except requests.RequestException:
        return None
    return None


def _call_openai_advisor(ctx, question, history=None):
    api_key = getattr(settings, 'OPENAI_API_KEY', '')
    if not api_key:
        return None

    try:
        response = requests.post(
            'https://api.openai.com/v1/responses',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': getattr(settings, 'OPENAI_MODEL', 'gpt-5.5'),
                'reasoning': {'effort': 'low'},
                'instructions': _advisor_instructions(),
                'input': _advisor_user_input(ctx, question, history),
            },
            timeout=getattr(settings, 'OPENAI_REQUEST_TIMEOUT', 20),
        )
        response.raise_for_status()
        data = response.json()
        answer = (data.get('output_text') or '').strip()
        if answer:
            return answer
        for item in data.get('output', []):
            for content in item.get('content', []):
                text = content.get('text')
                if text:
                    return text.strip()
    except requests.RequestException:
        return None
    return None


def _advisor_settings_for_bar(bar):
    if not bar:
        return None
    settings_obj, _ = BarAdvisorSettings.objects.get_or_create(bar=bar)
    return settings_obj


def _advisor_is_enabled(ctx):
    settings_obj = ctx.get('advisor_settings')
    if not settings_obj:
        return True
    if ctx.get('role') == 'SERVEUR':
        return settings_obj.server_enabled
    return settings_obj.owner_enabled


def _advisor_disabled_response(ctx):
    if ctx.get('role') == 'SERVEUR':
        return "Le conseiller serveur est désactivé par le propriétaire de cet établissement."
    return "Le conseiller propriétaire est désactivé pour cet établissement."


def _call_configured_advisor_model(ctx, question, history=None):
    return None


def _percent(part, total):
    part = Decimal(part or 0)
    total = Decimal(total or 0)
    if total <= 0:
        return Decimal('0')
    return (part / total) * 100


def _top_products(order_items, limit=5):
    rows = order_items.values('product_item__produit__nom', 'devise').annotate(
        qty=Sum('quantite'),
        revenue=Sum(F('quantite') * F('prix_unitaire'), output_field=DecimalField(max_digits=14, decimal_places=2)),
    ).order_by('-qty')[:limit]
    return [
        {
            'name': row['product_item__produit__nom'] or 'Produit',
            'qty': row['qty'] or 0,
            'revenue': row['revenue'] or 0,
            'devise': row['devise'] or 'USD',
        }
        for row in rows
    ]


def _stock_alerts(bar, limit=6):
    if not bar:
        return []
    return list(
        StockItem.objects.filter(bar=bar, quantite_actuelle__lte=F('seuil_alerte'))
        .select_related('produit', 'produit__categorie')
        .order_by('quantite_actuelle')[:limit]
    )


def _owner_context(profile):
    bar = profile.bar
    today = timezone.localdate()
    orders = Order.objects.filter(bar=bar)
    today_orders = orders.filter(date_creation__date=today)
    paid_today = today_orders.filter(statut='PAID')
    active = orders.filter(statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED'])
    paid_30 = orders.filter(statut='PAID', date_creation__gte=timezone.now() - timezone.timedelta(days=30))
    order_items_30 = OrderItem.objects.filter(order__in=paid_30).select_related('product_item__produit')
    revenue_today = paid_today.aggregate(usd=Sum('total_usd'), cdf=Sum('total_cdf'))
    revenue_30 = paid_30.aggregate(usd=Sum('total_usd'), cdf=Sum('total_cdf'), count=Count('id'))
    debt = Facture.objects.filter(bar=bar, type_facture='CLIENT', statut='IMPAYEE').aggregate(
        usd=Sum('montant_usd'), cdf=Sum('montant_cdf'), count=Count('id')
    )
    losses_30 = Perte.objects.filter(bar=bar, date_perte__gte=timezone.now() - timezone.timedelta(days=30)).aggregate(count=Count('id'), qty=Sum('quantite'))
    staff = []
    for member in PilotProfile.objects.filter(bar=bar, role='SERVEUR').select_related('user'):
        member_orders = orders.filter(serveur=member, statut='PAID', date_creation__gte=timezone.now() - timezone.timedelta(days=30))
        totals = member_orders.aggregate(usd=Sum('total_usd'), cdf=Sum('total_cdf'), count=Count('id'))
        staff.append({
            'name': f"{member.prenom} {member.nom}".strip() or member.user.get_username(),
            'count': totals['count'] or 0,
            'usd': totals['usd'] or 0,
            'cdf': totals['cdf'] or 0,
        })
    staff.sort(key=lambda item: (item['count'], item['usd'], item['cdf']), reverse=True)
    return {
        'role': 'PROPRIETAIRE',
        'bar': bar,
        'today_orders': today_orders.count(),
        'active_orders': active.count(),
        'active_tables': active.values('table_id').distinct().count(),
        'tables_total': Table.objects.filter(bar=bar).count(),
        'revenue_today': revenue_today,
        'revenue_30': revenue_30,
        'avg_basket_usd': (Decimal(revenue_30['usd'] or 0) / Decimal(revenue_30['count'] or 1)) if revenue_30['count'] else Decimal('0'),
        'debt': debt,
        'losses_30': losses_30,
        'stock_alerts': _stock_alerts(bar),
        'advisor_settings': _advisor_settings_for_bar(bar),
        'top_products': _top_products(order_items_30),
        'staff': staff[:5],
    }


def _server_context(profile):
    bar = profile.bar
    today = timezone.localdate()
    orders = Order.objects.filter(bar=bar, serveur=profile)
    today_orders = orders.filter(date_creation__date=today)
    paid_today = today_orders.filter(statut='PAID')
    active = orders.filter(statut__in=['PENDING', 'ACCEPTEE', 'PREPARING', 'SERVED'])
    paid_30 = orders.filter(statut='PAID', date_creation__gte=timezone.now() - timezone.timedelta(days=30))
    order_items_30 = OrderItem.objects.filter(order__in=paid_30).select_related('product_item__produit')
    revenue_today = paid_today.aggregate(usd=Sum('total_usd'), cdf=Sum('total_cdf'))
    revenue_30 = paid_30.aggregate(usd=Sum('total_usd'), cdf=Sum('total_cdf'), count=Count('id'))
    debt = Facture.objects.filter(bar=bar, type_facture='CLIENT', statut='IMPAYEE', orders__serveur=profile).distinct().aggregate(
        usd=Sum('montant_usd'), cdf=Sum('montant_cdf'), count=Count('id')
    )
    losses_30 = Perte.objects.filter(bar=bar, reported_by=profile, date_perte__gte=timezone.now() - timezone.timedelta(days=30)).aggregate(count=Count('id'), qty=Sum('quantite'))
    all_servers = []
    for member in PilotProfile.objects.filter(bar=bar, role='SERVEUR').select_related('user'):
        member_count = Order.objects.filter(bar=bar, serveur=member, statut='PAID', date_creation__gte=timezone.now() - timezone.timedelta(days=30)).count()
        all_servers.append((member_count, member.id))
    all_servers.sort(reverse=True)
    rank = next((idx for idx, (_, member_id) in enumerate(all_servers, 1) if member_id == profile.id), None)
    return {
        'role': 'SERVEUR',
        'bar': bar,
        'today_orders': today_orders.count(),
        'active_orders': active.count(),
        'active_tables': active.values('table_id').distinct().count(),
        'revenue_today': revenue_today,
        'revenue_30': revenue_30,
        'avg_basket_usd': (Decimal(revenue_30['usd'] or 0) / Decimal(revenue_30['count'] or 1)) if revenue_30['count'] else Decimal('0'),
        'debt': debt,
        'losses_30': losses_30,
        'stock_alerts': _stock_alerts(bar),
        'advisor_settings': _advisor_settings_for_bar(bar),
        'top_products': _top_products(order_items_30),
        'rank': rank,
        'team_size': len(all_servers),
    }


def _build_context(profile):
    if profile.role == 'PROPRIETAIRE':
        return _owner_context(profile)
    return _server_context(profile)


def _stock_answer(ctx):
    alerts = ctx['stock_alerts']
    if not alerts:
        return [
            'Aucun produit critique dans les alertes de stock actuellement.',
            'Gardez quand même un contrôle sur les produits les plus vendus des 30 derniers jours avant les heures de pointe.',
        ]
    first = alerts[0]
    lines = [f"Priorité stock: {first.produit.nom} est à {first.quantite_actuelle} unité(s), seuil {first.seuil_alerte}."]
    lines.append('Action conseillée: sécurisez le réassort des produits en alerte avant de pousser les ventes dessus.')
    if len(alerts) > 1:
        lines.append('Autres alertes: ' + ', '.join(f"{item.produit.nom} ({item.quantite_actuelle})" for item in alerts[1:4]) + '.')
    return lines


def _sales_answer(ctx):
    top = ctx['top_products']
    lines = [
        f"Aujourd'hui: {ctx['today_orders']} commande(s), revenu encaissé {_money(ctx['revenue_today'].get('usd'), ctx['revenue_today'].get('cdf'))}.",
        f"Sur 30 jours: {ctx['revenue_30'].get('count') or 0} commande(s), panier moyen estimé {ctx['avg_basket_usd']:.2f} $ sur la part USD.",
    ]
    if top:
        best = top[0]
        lines.append(f"Produit moteur: {best['name']} avec {best['qty']} vente(s). Mettez-le en avant si le stock suit.")
    lines.append('Conseil recettes: proposez un produit complémentaire à chaque commande active plutôt qu’une remise directe; cela augmente le panier sans réduire la marge.')
    return lines


def _team_answer(ctx):
    if ctx['role'] == 'SERVEUR':
        rank = ctx.get('rank')
        if rank:
            return [
                f"Votre rang sur les commandes payées des 30 derniers jours est #{rank} sur {ctx.get('team_size') or 1}.",
                f"Vous avez {ctx['active_orders']} commande(s) active(s). Terminez les tickets en cours avant de prendre une nouvelle table.",
                'Conseil performance: annoncez systématiquement un produit premium ou un format bouteille quand la table commande plusieurs verres.',
            ]
        return ['Vos données personnelles sont encore limitées. Prenez quelques commandes et je pourrai comparer vos performances.']
    staff = ctx.get('staff') or []
    if not staff:
        return ['Aucun serveur confirmé avec ventes récentes. Dès que l’équipe encaisse, je pourrai détecter les meilleurs vendeurs et les points de retard.']
    best = staff[0]
    lines = [f"Meilleur volume récent: {best['name']} avec {best['count']} commande(s) payée(s) sur 30 jours."]
    if len(staff) > 1:
        low = staff[-1]
        lines.append(f"Point d’attention: {low['name']} est à {low['count']} commande(s). Vérifiez son affectation de tables ou son besoin d’accompagnement.")
    lines.append('Conseil équipe: comparez chaque serveur sur temps de service, panier moyen et dettes ouvertes, pas seulement sur nombre de tickets.')
    return lines


def _debt_answer(ctx):
    debt = ctx['debt']
    lines = [f"Dettes ouvertes: {debt.get('count') or 0} facture(s), total {_money(debt.get('usd'), debt.get('cdf'))}."]
    if debt.get('count'):
        lines.append('Action conseillée: relancez d’abord les dettes liées aux commandes récentes, puis bloquez les nouvelles dettes sans garant pour les clients non éligibles.')
        if ctx['role'] == 'SERVEUR':
            lines.append('Pour vous: évitez de vous porter garant si le client n’a pas d’historique suffisant ou si le propriétaire n’a pas validé la dette.')
    else:
        lines.append('Aucune dette ouverte dans votre périmètre. Gardez cette discipline en vérifiant l’éligibilité avant tout paiement différé.')
    return lines


def _service_answer(ctx):
    occupancy = _percent(ctx.get('active_tables'), ctx.get('tables_total') or ctx.get('active_tables')) if ctx.get('tables_total') else Decimal('0')
    lines = [f"Service en cours: {ctx['active_orders']} commande(s) active(s) sur {ctx['active_tables']} table(s)."]
    if ctx.get('tables_total'):
        lines.append(f"Occupation estimée: {occupancy:.0f}% des tables.")
    if ctx['active_orders'] >= 4:
        lines.append('Action immédiate: priorisez livraison et encaissement avant d’ouvrir de nouvelles commandes.')
    else:
        lines.append('Vous avez de la marge opérationnelle: poussez les ventes additionnelles sur les tables déjà servies.')
    return lines


def _loss_answer(ctx):
    losses = ctx['losses_30']
    lines = [f"Pertes déclarées sur 30 jours: {losses.get('count') or 0} déclaration(s), {losses.get('qty') or 0} unité(s)."]
    if losses.get('count'):
        lines.append('Conseil: croisez les pertes avec les shifts et les produits en alerte pour détecter les erreurs de service ou de stockage.')
    else:
        lines.append('Aucune perte récente déclarée. Continuez à déclarer les casses immédiatement pour garder la marge fiable.')
    return lines


def _personalized_advice_answer(ctx, profile):
    bar_name = ctx['bar'].nom if ctx.get('bar') else 'cet établissement'
    first_name = (getattr(profile, 'prenom', '') or profile.user.first_name or '').strip()
    intro_name = f" {first_name}" if first_name else ''
    lines = []

    if ctx['role'] == 'SERVEUR':
        lines.append(f"Conseil personnalisé{intro_name}: concentrez-vous sur les commandes actives avant de chercher une nouvelle table.")
        if ctx.get('rank'):
            lines.append(f"Votre position récente est #{ctx.get('rank')} sur {ctx.get('team_size') or 1}; améliorez-la avec des ventes additionnelles simples sur les tables déjà servies.")
        if ctx['top_products']:
            best = ctx['top_products'][0]
            lines.append(f"Votre produit moteur récent est {best['name']}; proposez-le en priorité quand le stock suit.")
        if ctx['debt'].get('count'):
            lines.append("Attention dettes: évitez les nouveaux paiements différés sans validation claire du propriétaire.")
        if ctx['stock_alerts']:
            lines.append(f"Stock à surveiller: {ctx['stock_alerts'][0].produit.nom}. Ne le poussez pas si le réassort n'est pas sécurisé.")
        return lines

    lines.append(f"Conseil personnalisé pour {bar_name}: pilotez d'abord les points qui peuvent bloquer les ventes aujourd'hui.")
    if ctx['stock_alerts']:
        first_stock = ctx['stock_alerts'][0]
        lines.append(f"Priorité stock: {first_stock.produit.nom} est à {first_stock.quantite_actuelle} unité(s), seuil {first_stock.seuil_alerte}. Réassort avant promotion.")
    if ctx['active_orders']:
        lines.append(f"Service: {ctx['active_orders']} commande(s) active(s) sur {ctx['active_tables']} table(s). Faites livrer/encaisser avant d'ouvrir trop de nouvelles commandes.")
    if ctx['top_products']:
        best = ctx['top_products'][0]
        lines.append(f"Ventes: {best['name']} tire les volumes sur 30 jours ({best['qty']} vente(s)). Mettez-le en avant seulement si le stock est confortable.")
    if ctx['debt'].get('count'):
        lines.append(f"Dettes: {ctx['debt'].get('count')} facture(s) ouverte(s), total {_money(ctx['debt'].get('usd'), ctx['debt'].get('cdf'))}. Relancez avant le prochain pic de service.")
    if ctx.get('staff'):
        best_staff = ctx['staff'][0]
        lines.append(f"Équipe: {best_staff['name']} a le meilleur volume récent. Utilisez ses méthodes comme référence pour les autres serveurs.")
    if len(lines) == 1:
        lines.append("Les données sont encore limitées: commencez par suivre stocks critiques, commandes payées, dettes ouvertes et pertes déclarées chaque jour.")
    return lines


def generate_advisor_response(profile, question, history=None):
    ctx = _build_context(profile)
    if not _advisor_is_enabled(ctx):
        return {
            'answer': _advisor_disabled_response(ctx),
            'role': ctx['role'],
            'generated_at': timezone.localtime().strftime('%d/%m %H:%M'),
        }

    model_answer = _call_configured_advisor_model(ctx, question, history)
    if model_answer:
        return {
            'answer': model_answer,
            'role': ctx['role'],
            'generated_at': timezone.localtime().strftime('%d/%m %H:%M'),
        }

    social_answer = _small_talk_response(profile, question, history)
    if social_answer:
        return {
            'answer': social_answer,
            'role': profile.role or '',
            'generated_at': timezone.localtime().strftime('%d/%m %H:%M'),
        }

    q = _normalize(question)
    tokens = set(_tokens(question))

    if _matches(tokens, q, STOCK_WORDS):
        lines = _stock_answer(ctx)
    elif _matches(tokens, q, SALES_WORDS):
        lines = _sales_answer(ctx)
    elif _matches(tokens, q, TEAM_WORDS):
        lines = _team_answer(ctx)
    elif _matches(tokens, q, DEBT_WORDS):
        lines = _debt_answer(ctx)
    elif _matches(tokens, q, SERVICE_WORDS):
        lines = _service_answer(ctx)
    elif _matches(tokens, q, LOSS_WORDS):
        lines = _loss_answer(ctx)
    elif any(phrase in q for phrase in ADVICE_PHRASES):
        lines = _personalized_advice_answer(ctx, profile)
    else:
        return {
            'answer': _unknown_intent_response(profile),
            'role': ctx['role'],
            'generated_at': timezone.localtime().strftime('%d/%m %H:%M'),
        }

    return {
        'answer': '\n'.join(f"- {line}" for line in lines),
        'role': ctx['role'],
        'generated_at': timezone.localtime().strftime('%d/%m %H:%M'),
    }
