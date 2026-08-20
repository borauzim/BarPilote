from django.db import migrations
from django.utils import timezone


def mark_existing_paid_orders(apps, schema_editor):
    Order = apps.get_model("proprietaire", "Order")
    Order.objects.filter(statut="PAID", stock_deducted_at__isnull=True).update(
        stock_deducted_at=timezone.now()
    )


class Migration(migrations.Migration):
    dependencies = [
        ("proprietaire", "0045_sale_deduire_stock"),
    ]

    operations = [
        migrations.RunPython(mark_existing_paid_orders, migrations.RunPython.noop),
    ]
