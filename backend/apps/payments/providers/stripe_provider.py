"""
MAIDAN — Stripe Payment Provider

Full Stripe integration with webhooks, PaymentIntents.
"""

import logging
from decimal import Decimal
from typing import Optional

import stripe
from django.conf import settings

from .base import PaymentProvider, PaymentResult, PaymentStatus, RefundResult

logger = logging.getLogger("maidan.payments.stripe")


class StripeProvider(PaymentProvider):
    """Stripe payment provider — international markets."""

    provider_name = "stripe"

    def __init__(self):
        stripe.api_key = settings.STRIPE_SECRET_KEY
        self.webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    def _amount_to_cents(self, amount: Decimal, currency: str) -> int:
        """Convert decimal amount to smallest currency unit (cents/halalas)."""
        zero_decimal_currencies = {"BIF", "CLP", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "VND", "VUV", "XAF", "XOF", "XPF"}
        if currency.upper() in zero_decimal_currencies:
            return int(amount)
        return int(amount * 100)

    def create_payment(
        self,
        invoice_number: str,
        amount: Decimal,
        currency: str,
        customer_email: str,
        customer_name: str,
        description: str,
        callback_url: str,
        return_url: str,
        metadata: Optional[dict] = None,
    ) -> PaymentResult:
        """Create a Stripe PaymentIntent."""

        try:
            intent = stripe.PaymentIntent.create(
                amount=self._amount_to_cents(amount, currency),
                currency=currency.lower(),
                description=description,
                receipt_email=customer_email,
                metadata={
                    "invoice_number": invoice_number,
                    "customer_name": customer_name,
                    **(metadata or {}),
                },
                automatic_payment_methods={"enabled": True},
            )

            return PaymentResult(
                status=PaymentStatus.PENDING,
                transaction_id=intent.id,
                amount=amount,
                currency=currency,
                provider=self.provider_name,
                raw_response=dict(intent),
                metadata={"client_secret": intent.client_secret},
            )

        except stripe.error.CardError as e:
            logger.warning(f"Stripe card error: {e}")
            return PaymentResult(
                status=PaymentStatus.FAILED,
                transaction_id="",
                amount=amount,
                currency=currency,
                provider=self.provider_name,
                raw_response={"error": str(e)},
                error_message=e.user_message,
            )
        except stripe.error.StripeError as e:
            logger.exception(f"Stripe error: {e}")
            return PaymentResult(
                status=PaymentStatus.FAILED,
                transaction_id="",
                amount=amount,
                currency=currency,
                provider=self.provider_name,
                raw_response={"error": str(e)},
                error_message=str(e),
            )

    def verify_payment(self, transaction_id: str) -> PaymentResult:
        """Check Stripe PaymentIntent status."""

        try:
            intent = stripe.PaymentIntent.retrieve(transaction_id)

            status_map = {
                "succeeded": PaymentStatus.SUCCESS,
                "canceled": PaymentStatus.CANCELLED,
                "requires_payment_method": PaymentStatus.FAILED,
                "processing": PaymentStatus.PENDING,
                "requires_action": PaymentStatus.PENDING,
                "requires_confirmation": PaymentStatus.PENDING,
            }

            amount = Decimal(str(intent.amount / 100))  # Convert from cents
            status = status_map.get(intent.status, PaymentStatus.PENDING)

            receipt_url = None
            if intent.status == "succeeded" and intent.get("charges", {}).get("data"):
                receipt_url = intent.charges.data[0].get("receipt_url")

            return PaymentResult(
                status=status,
                transaction_id=transaction_id,
                amount=amount,
                currency=intent.currency.upper(),
                provider=self.provider_name,
                raw_response=dict(intent),
                receipt_url=receipt_url,
            )

        except stripe.error.StripeError as e:
            logger.exception(f"Stripe verify error: {e}")
            return PaymentResult(
                status=PaymentStatus.FAILED,
                transaction_id=transaction_id,
                amount=Decimal(0),
                currency="USD",
                provider=self.provider_name,
                raw_response={"error": str(e)},
                error_message=str(e),
            )

    def refund(self, transaction_id: str, amount: Decimal, reason: str = "") -> RefundResult:
        """Create a Stripe refund."""

        try:
            intent = stripe.PaymentIntent.retrieve(transaction_id)
            charge_id = intent.get("latest_charge")

            if not charge_id:
                return RefundResult(
                    status=PaymentStatus.FAILED,
                    refund_id="",
                    amount=amount,
                    currency="",
                    provider=self.provider_name,
                    raw_response={},
                    error_message="No charge found for PaymentIntent",
                )

            refund = stripe.Refund.create(
                charge=charge_id,
                amount=self._amount_to_cents(amount, intent.currency.upper()),
                reason="requested_by_customer" if not reason else None,
                metadata={"reason": reason},
            )

            success = refund.status == "succeeded"
            return RefundResult(
                status=PaymentStatus.REFUNDED if success else PaymentStatus.FAILED,
                refund_id=refund.id,
                amount=Decimal(str(refund.amount / 100)),
                currency=refund.currency.upper(),
                provider=self.provider_name,
                raw_response=dict(refund),
            )

        except stripe.error.StripeError as e:
            logger.exception(f"Stripe refund error: {e}")
            return RefundResult(
                status=PaymentStatus.FAILED,
                refund_id="",
                amount=amount,
                currency="",
                provider=self.provider_name,
                raw_response={"error": str(e)},
                error_message=str(e),
            )

    def verify_webhook(self, payload: bytes, signature: str) -> Optional[dict]:
        """Verify Stripe webhook signature and return event."""
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            return dict(event)
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            logger.warning(f"Stripe webhook verification failed: {e}")
            return None
