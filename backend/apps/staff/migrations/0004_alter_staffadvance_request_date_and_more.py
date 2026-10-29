from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0003_staffpayslip_advance_deductions_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='staffadvance',
            name='request_date',
            field=models.DateField(default=django.utils.timezone.localdate),
        ),
        migrations.AlterField(
            model_name='staffadvancerepayment',
            name='repayment_date',
            field=models.DateField(default=django.utils.timezone.localdate),
        ),
    ]
