from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('proprietaire', '0029_perte_reported_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='pilotprofile',
            name='last_seen',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Dernière activité'),
        ),
    ]
