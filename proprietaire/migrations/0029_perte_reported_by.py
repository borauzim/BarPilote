from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('proprietaire', '0028_alter_pilotprofile_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='perte',
            name='reported_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reported_losses',
                to='proprietaire.pilotprofile',
                verbose_name='Signalée par',
            ),
        ),
    ]
