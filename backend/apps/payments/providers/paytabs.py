"""
MAIDAN — PayTabs Payment Provider (MENA Primary)

PayTabs API v2 integration for SAR/AED markets.
Docs: https://site.paytabs.com/en/pt2-apis/
"""

import hashlib
import hmac
import logging
from decimal import Decimal
from typing import Optional

import requests
from django.conf import settings

from .base import PaymentProvider, PaymentResult, PaymentStatus, RefundResult

logger = logging.getLogger("maidan.payments.paytabs")


class PayTabsProvider(PaymentProvider):
    """PayTabs payment gateway — primary provider for MENA region."""

    provider_name = "paytabs"

    def __init__(self):
        self.profile_id = settings.PAYTABS_PROFILE_ID
        self.server_key = settings.PAYTABS_SERVER_KEY
        self.base_url = settings.PAYTABS_BASE_URL
        self.region = settings.PAYTABS_REGION

    def _get_headers(self) -> dict:
        return {
            "Authorization": self.server_key,
            "Content-Type": "application/json",
        }

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
        """Create a PayTabs hosted payment page."""

        payload = {
            "profile_id": self.profile_id,
            "tran_type": "sale",
            "tran_class": "ecom",
            "cart_id": invoice_number,
            "cart_currency": currency,
            "cart_amount": float(amount),
            "cart_description": description,
            "callback": callback_url,
            "return": return_url,
            "customer_details": {
                "name": customer_name,
                "email": customer_email,
                "phone": metadata.get("phone", "") if metadata else "",
                "street1": metadata.get("address", "N/A") if metadata else "N/A",
                "city": metadata.get("city", "Riyadh") if metadata else "Riyadh",
                "country": metadata.get("country", "SA") if metadata else "SA",
            },
        }

        try:
            response = requests.post(
                f"{self.base_url}/payment/request",
                json=payload,
                headers=self._get_headers(),
                timeout=30,
            )
            data = response.json()

            if response.status_code == 200 and data.get("redirect_url"):
                return PaymentResult(
                    status=PaymentStatus.PENDING,
                    transaction_id=str(data.get("tran_ref", "")),
                    amount=amount,
                    currency=currency,
                    provider=self.provider_name,
                    redirect_url=data["redirect_url"],
                    raw_response=data,
                )
            else:
                logger.error(f"PayTabs create_payment failed: {data}")
                return PaymentResult(
                    status=PaymentStatus.FAILED,
                    transaction_id="",
                    amount=amount,
                    currency=currency,
                    provider=self.provider_name,
                    raw_response=data,
                    error_message=data.get("message", "Payment initiation failed"),
                )

        except requests.Timeout:
            logger.error("PayTabs create_payment timed out")
            return PaymentResult(
                status=PaymentStatus.FAILED,
                transaction_id="",
                amount=amount,
                currency=currency,
                provider=self.provider_name,
                raw_response={},
                error_message="Payment gateway timeout",
            )
        except Exception as e:
            logger.exception(f"PayTabs create_payment error: {e}")
            return PaymentResult(
                status=PaymentStatus.FAILED,
                transaction_id="",
                amount=amount,
                currency=currency,
                provider=self.provider_name,
                raw_response={},
                error_message=str(e),
            )

    def verify_payment(self, transaction_id: str) -> PaymentResult:
        """Query a PayTabs transaction status."""

        payload = {
            "profile_id": self.profile_id,
            "tran_ref": transaction_id,
        }

        try:
            response = requests.post(
                f"{self.base_url}/payment/query",
                json=payload,
                headers=self._get_headers(),
                timeout=30,
            )
            data = response.json()

            payment_result = data.get("payment_result", {})
            response_status = payment_result.get("response_status", "")

            if response_status == "A":
                status = PaymentStatus.SUCCESS
            elif response_status in ["D", "E", "X"]:
                status = PaymentStatus.FAILED
            else:
                status = PaymentStatus.PENDING

            return PaymentResult(
                status=status,
                transaction_id=transaction_id,
                amount=Decimal(str(data.get("cart_amount", 0))),
                currency=data.get("cart_currency", "SAR"),
                provider=self.provider_name,
                raw_response=data,
                error_message=payment_result.get("response_message") if status == PaymentStatus.FAILED else None,
            )

        except Exception as e:
            logger.exception(f"PayTabs verify_payment error: {e}")
            return PaymentResult(
                status=PaymentStatus.FAILED,
                transaction_id=transaction_id,
                amount=Decimal(0),
                currency="SAR",
                provider=self.provider_name,
                raw_response={},
                error_message=str(e),
            )

    def refund(self, transaction_id: str, amount: Decimal, reason: str = "") -> RefundResult:
        """Issue a refund via PayTabs."""

        payload = {
            "profile_id": self.profile_id,
            "tran_type": "refund",
            "tran_class": "ecom",
            "tran_ref": transaction_id,
            "cart_id": f"REFUND-{transaction_id}",
            "cart_currency": "SAR",
            "cart_amount": float(amount),
            "cart_description": reason or "Refund",
        }

        try:
            response = requests.post(
                f"{self.base_url}/payment/request",
                json=payload,
                headers=self._get_headers(),
                timeout=30,
            )
            data = response.json()
            payment_result = data.get("payment_result", {})
            success = payment_result.get("response_status") == "A"

            return RefundResult(
                status=PaymentStatus.REFUNDED if success else PaymentStatus.FAILED,
                refund_id=str(data.get("tran_ref", "")),
                amount=amount,
                currency="SAR",
                provider=self.provider_name,
                raw_response=data,
                error_message=None if success else payment_result.get("response_message"),
            )

        except Exception as e:
            logger.exception(f"PayTabs refund error: {e}")
            return RefundResult(
                status=PaymentStatus.FAILED,
                refund_id="",
                amount=amount,
                currency="SAR",
                provider=self.provider_name,
                raw_response={},
                error_message=str(e),
            )

    def verify_webhook(self, payload: dict, signature: str) -> bool:
        """Verify PayTabs IPN webhook signature."""
        # PayTabs sends a SHA-512 HMAC signature
        message = f"{self.profile_id}{payload.get('tran_ref', '')}{payload.get('cart_amount', '')}"
        expected = hmac.new(
            self.server_key.encode(),
            message.encode(),
            hashlib.sha512,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
