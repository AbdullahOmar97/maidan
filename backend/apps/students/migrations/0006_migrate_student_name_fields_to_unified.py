from django.db import migrations

def migrate_student_names(apps, schema_editor):
    Student = apps.get_model("students", "Student")
    for student in Student.objects.all():
        if not student.first_name and student.first_name_ar:
            student.first_name = student.first_name_ar
        if not student.last_name and student.last_name_ar:
            student.last_name = student.last_name_ar
        student.save()

class Migration(migrations.Migration):

    dependencies = [
        ("students", "0005_remove_student_unique_student_per_branch_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_student_names, reverse_code=migrations.RunPython.noop),
    ]
