"""MAIDAN — Payments App Views + Webhook Handlers"""
import logging
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.permissions import CanManageBilling
from .models import Payment

logger = logging.getLogger("maidan.payments")


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.select_related("invoice", "student").all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageBilling]
    filterset_fields = ["status", "provider", "student_id", "invoice_id"]


class PayTabsWebhookView(APIView):
    """Handle PayTabs IPN (Instant Payment Notification) callbacks."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        tran_ref = data.get("tran_ref", "")
        tran_type = data.get("tran_type", "")
        payment_result = data.get("payment_result", {})
        response_status = payment_result.get("response_status", "")

        logger.info(f"PayTabs webhook: {tran_ref} status={response_status}")

        try:
            payment = Payment.objects.get(provider_transaction_id=tran_ref)
            if response_status == "A":
                payment.mark_successful(tran_ref)
            else:
                payment.status = Payment.Status.FAILED
                payment.provider_response = data
                payment.save(update_fields=["status", "provider_response"])
        except Payment.DoesNotExist:
            logger.warning(f"PayTabs webhook: payment not found for {tran_ref}")

        return Response({"status": "ok"})


class StripeWebhookView(APIView):
    """Handle Stripe webhook events."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from .providers.stripe_provider import StripeProvider
        provider = StripeProvider()

        payload = request.body
        signature = request.META.get("HTTP_STRIPE_SIGNATURE", "")

        event = provider.verify_webhook(payload, signature)
        if not event:
            return Response({"error": "Invalid signature"}, status=status.HTTP_400_BAD_REQUEST)

        event_type = event.get("type", "")
        logger.info(f"Stripe webhook: {event_type}")

        if event_type == "payment_intent.succeeded":
            intent_id = event["data"]["object"]["id"]
            try:
                payment = Payment.objects.get(provider_transaction_id=intent_id)
                payment.mark_successful(intent_id)
            except Payment.DoesNotExist:
                logger.warning(f"Stripe webhook: payment not found for {intent_id}")

        elif event_type == "payment_intent.payment_failed":
            intent_id = event["data"]["object"]["id"]
            try:
                payment = Payment.objects.get(provider_transaction_id=intent_id)
                payment.status = Payment.Status.FAILED
                payment.save(update_fields=["status"])
            except Payment.DoesNotExist:
                pass

        return Response({"status": "ok"})
