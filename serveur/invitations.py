from urllib.parse import parse_qs, urlparse
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from proprietaire.models import Bar
from .models import InvitationCode, ServeurProfile


class InvitationError(ValueError):
    pass


def extract_invitation_token(raw_value):
    if raw_value is None:
        raise InvitationError("Code d'invitation manquant.")

    value = str(raw_value).strip()
    if not value:
        raise InvitationError("Code d'invitation manquant.")

    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc:
        query = parse_qs(parsed.query)
        for key in ("code", "invitation_code", "invite"):
            if query.get(key):
                return query[key][0].strip()

        parts = [part for part in parsed.path.split("/") if part]
        if parts:
            return parts[-1].strip()

    return value


def normalize_uuid_token(token):
    cleaned = str(token).strip().replace("-", "").replace(" ", "")
    try:
        return UUID(cleaned)
    except (TypeError, ValueError):
        return None


def resolve_invitation(raw_value):
    token = extract_invitation_token(raw_value)
    uuid_token = normalize_uuid_token(token)

    if uuid_token:
        bar = Bar.objects.filter(code_invitation=uuid_token).first()
        if bar:
            return bar, None, uuid_token

    invitation = InvitationCode.objects.select_related("bar", "proprietaire").filter(code=token).first()
    if not invitation:
        raise InvitationError("Code d'invitation invalide ou établissement introuvable.")

    if not invitation.is_valid():
        raise InvitationError("Ce code d'invitation a déjà été utilisé ou a expiré.")

    return invitation.bar, invitation, token


@transaction.atomic
def attach_user_to_bar(user, raw_value):
    bar, invitation, normalized_code = resolve_invitation(raw_value)
    profile, created = ServeurProfile.objects.get_or_create(
        user=user,
        defaults={
            "nom": user.last_name or "SERVEUR",
            "prenom": user.first_name or "Nouveau",
            "email": user.email or f"{user.username}@barpilote.local",
            "bar": bar,
            "actif": True,
            "confirmation_status": "PENDING",
        },
    )

    profile.bar = bar
    profile.actif = True
    if profile.confirmation_status == "REJECTED":
        profile.confirmation_status = "PENDING"
    elif created or profile.confirmation_status != "CONFIRMED":
        profile.confirmation_status = "PENDING"
    if not profile.email:
        profile.email = user.email or f"{user.username}@barpilote.local"
    profile.save()

    if invitation:
        invitation.is_used = True
        invitation.used_by = profile
        invitation.used_at = timezone.now()
        invitation.save(update_fields=["is_used", "used_by", "used_at"])

    return profile, bar, normalized_code
