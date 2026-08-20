"""Lecture des rapports Google AdSense Management API v2."""
from datetime import date, timedelta
from decimal import Decimal
import requests
from django.conf import settings
from django.core.cache import cache

TOKEN_URL = "https://oauth2.googleapis.com/token"
REPORT_URL = "https://adsense.googleapis.com/v2/{account}/reports:generate"
CACHE_KEY = "barpilote:adsense:report:last30"


def fetch_report(days=30):
    account = (getattr(settings, "ADSENSE_ACCOUNT_ID", "") or "").strip()
    refresh_token = (getattr(settings, "ADSENSE_REFRESH_TOKEN", "") or "").strip()
    client_id = (getattr(settings, "GOOGLE_ADSENSE_OAUTH_CLIENT_ID", "") or getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or "").strip()
    client_secret = (getattr(settings, "GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET", "") or getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "") or "").strip()
    if not all((account, refresh_token, client_id, client_secret)):
        return {"configured": False, "error": "Configuration OAuth AdSense incomplète."}
    cached = cache.get(CACHE_KEY)
    if cached:
        return cached
    token_response = requests.post(TOKEN_URL, data={"client_id": client_id, "client_secret": client_secret, "refresh_token": refresh_token, "grant_type": "refresh_token"}, timeout=15)
    token_response.raise_for_status()
    access_token = token_response.json().get("access_token")
    if not access_token:
        return {"configured": True, "error": "Jeton AdSense invalide."}
    end = date.today()
    start = end - timedelta(days=max(1, days) - 1)
    params = [
        ("dimensions", "DATE"), ("metrics", "IMPRESSIONS"),
        ("metrics", "CLICKS"), ("metrics", "ESTIMATED_EARNINGS"),
        ("dateRange", "CUSTOM"), ("startDate.year", start.year), ("startDate.month", start.month), ("startDate.day", start.day),
        ("endDate.year", end.year), ("endDate.month", end.month), ("endDate.day", end.day),
        ("currencyCode", "USD"), ("languageCode", "fr"),
    ]
    response = requests.get(REPORT_URL.format(account=account), params=params, headers={"Authorization": f"Bearer {access_token}"}, timeout=20)
    response.raise_for_status()
    payload = response.json()
    totals = {"impressions": 0, "clicks": 0, "earnings_usd": Decimal("0.00")}
    for row in payload.get("rows", []):
        cells = row.get("cells", [])
        values = [cell.get("value", "0") for cell in cells]
        if len(values) >= 4:
            totals["impressions"] += int(float(values[1] or 0))
            totals["clicks"] += int(float(values[2] or 0))
            totals["earnings_usd"] += Decimal(values[3] or "0")
    result = {"configured": True, "start": start, "end": end, **totals, "error": ""}
    cache.set(CACHE_KEY, result, 600)
    return result
