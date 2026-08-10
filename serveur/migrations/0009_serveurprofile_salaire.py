from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('serveur', '0008_serveurprofile_inventory_access_granted_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='serveurprofile',
            name='salaire_devise',
            field=models.CharField(choices=[('USD', 'USD'), ('CDF', 'CDF')], default='CDF', max_length=3, verbose_name='Devise du salaire'),
        ),
        migrations.AddField(
            model_name='serveurprofile',
            name='salaire_mensuel',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name='Salaire mensuel'),
        ),
    ]
