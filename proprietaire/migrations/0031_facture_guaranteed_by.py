from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('proprietaire', '0030_pilotprofile_last_seen'),
    ]

    operations = [
        migrations.AddField(
            model_name='facture',
            name='guaranteed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='guaranteed_factures',
                to='proprietaire.pilotprofile',
                verbose_name='Garant',
            ),
        ),
    ]
