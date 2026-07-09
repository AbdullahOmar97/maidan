from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.utils import timezone
from decimal import Decimal

from apps.accounts.models import User
from apps.students.models import Student, Location
from apps.billing.models import Invoice
from .models import Product, ProductOption, Order, OrderItem


class StoreAPITestCase(TenantTestCase):
    """Test suite for the Club E-Commerce Store feature."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()

        # Create a test location (required for Student)
        self.location = Location.objects.create(
            name="Test Dojo Branch",
            address="123 Test St",
            city="Riyadh",
            country="SA"
        )

        # Create a staff user
        self.staff_user = User.objects.create_user(
            email="staff@maidan.app",
            password="securepassword123",
            first_name="Staff",
            last_name="Member",
            role=User.Role.MANAGER,
            is_staff=True
        )

        # Create a student user
        self.student_user = User.objects.create_user(
            email="student@maidan.app",
            password="securepassword123",
            first_name="Student",
            last_name="One",
            role=User.Role.STUDENT
        )

        # Create the Student profile linked to student user
        self.student = Student.objects.create(
            first_name="Student",
            last_name="One",
            phone="0500000000",
            email="student@maidan.app",
            location=self.location,
            user_account=self.student_user,
            status=Student.Status.ACTIVE
        )

        # Create products
        self.uniform = Product.objects.create(
            name="بدلة تايكوندو",
            description="بدلة تايكوندو قطنية عالية الجودة",
            price=Decimal("45.00"),
            is_active=True
        )

        # Create options/sizes
        self.size_m = ProductOption.objects.create(
            product=self.uniform,
            name="الحجم",
            value="M",
            additional_price=Decimal("0.00"),
            stock=10
        )
        self.size_l = ProductOption.objects.create(
            product=self.uniform,
            name="الحجم",
            value="L",
            additional_price=Decimal("5.00"),
            stock=5
        )

        # Belt product without options
        self.belt = Product.objects.create(
            name="حزام أسود",
            description="حزام أسود قطني مطرز",
            price=Decimal("15.00"),
            is_active=True
        )

    def test_list_products_authenticated(self):
        """Authenticated users should be able to list active products."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get("/api/v1/store/products/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should see 2 products (uniform and belt)
        self.assertEqual(len(response.data), 2)

    def test_staff_create_product(self):
        """Staff should be able to create new products and options."""
        self.client.force_authenticate(user=self.staff_user)
        product_data = {
            "name": "حامي الساقين",
            "description": "حامي ساقين واقٍ للمباريات",
            "price": "25.00",
            "is_active": True
        }
        response = self.client.post("/api/v1/store/products/", product_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        product_id = response.data["id"]

        # Add an option
        option_data = {
            "name": "الحجم",
            "value": "L",
            "additional_price": "2.00",
            "stock": 20
        }
        option_response = self.client.post(
            f"/api/v1/store/products/{product_id}/options/",
            option_data
        )
        self.assertEqual(option_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProductOption.objects.filter(product_id=product_id).count(), 1)

    def test_client_cannot_create_product(self):
        """Students/clients should not be able to create products."""
        self.client.force_authenticate(user=self.student_user)
        product_data = {
            "name": "حامي الساقين",
            "price": "25.00"
        }
        response = self.client.post("/api/v1/store/products/", product_data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_order_success(self):
        """Placing an order successfully should deduct stock and generate an invoice."""
        self.client.force_authenticate(user=self.student_user)
        
        # Order 2 M uniforms (price 45.00 each) and 1 black belt (price 15.00)
        order_data = {
            "student": self.student.id,
            "payment_method": "cash",
            "notes": "الرجاء توفير بدلة مقاس M نظيفة",
            "items": [
                {
                    "product": self.uniform.id,
                    "option": self.size_m.id,
                    "quantity": 2
                },
                {
                    "product": self.belt.id,
                    "quantity": 1
                }
            ]
        }
        
        response = self.client.post("/api/v1/store/orders/", order_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Total: (45.00 * 2) + 15.00 = 105.00
        self.assertEqual(Decimal(response.data["total_amount"]), Decimal("105.00"))
        
        # Stock check: M size uniform should be 8 (10 - 2)
        self.size_m.refresh_from_db()
        self.assertEqual(self.size_m.stock, 8)
        
        # Invoice check: an invoice must have been generated
        invoice_id = response.data["invoice"]
        self.assertTrue(invoice_id)
        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.total_amount, Decimal("105.00"))
        self.assertEqual(invoice.status, Invoice.Status.PENDING)

    def test_create_order_insufficient_stock(self):
        """Placing an order with quantity exceeding stock should fail."""
        self.client.force_authenticate(user=self.student_user)
        
        # Order 6 L uniforms (only 5 in stock)
        order_data = {
            "student": self.student.id,
            "items": [
                {
                    "product": self.uniform.id,
                    "option": self.size_l.id,
                    "quantity": 6
                }
            ]
        }
        
        response = self.client.post("/api/v1/store/orders/", order_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Stock should remain 5
        self.size_l.refresh_from_db()
        self.assertEqual(self.size_l.stock, 5)

    def test_cancel_order_restores_stock(self):
        """Cancelling an order should restore the option stock and void the invoice."""
        self.client.force_authenticate(user=self.student_user)
        
        order_data = {
            "student": self.student.id,
            "items": [
                {
                    "product": self.uniform.id,
                    "option": self.size_l.id,
                    "quantity": 2
                }
            ]
        }
        
        # Create order
        response = self.client.post("/api/v1/store/orders/", order_data, format="json")
        order_id = response.data["id"]
        
        self.size_l.refresh_from_db()
        self.assertEqual(self.size_l.stock, 3) # 5 - 2 = 3
        
        # Cancel order
        cancel_response = self.client.post(f"/api/v1/store/orders/{order_id}/cancel/")
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        
        # Stock should be restored to 5
        self.size_l.refresh_from_db()
        self.assertEqual(self.size_l.stock, 5)
        
        # Invoice should be VOID
        invoice_id = response.data["invoice"]
        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.status, Invoice.Status.VOID)
