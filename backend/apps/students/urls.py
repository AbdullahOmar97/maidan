"""
MAIDAN — Students App URLs
"""

from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from django.urls import path, include

from . import views

router = DefaultRouter()
router.register(r"locations", views.LocationViewSet, basename="location")
router.register(r"families", views.FamilyViewSet, basename="family")
router.register(r"", views.StudentViewSet, basename="student")

# Nested routes: /students/{student_pk}/notes/ and /students/{student_pk}/documents/
student_router = routers.NestedDefaultRouter(router, r"", lookup="student")
student_router.register(r"notes", views.StudentNoteViewSet, basename="student-notes")
student_router.register(r"documents", views.StudentDocumentViewSet, basename="student-documents")

urlpatterns = [
    path("", include(router.urls)),
    path("", include(student_router.urls)),
]
