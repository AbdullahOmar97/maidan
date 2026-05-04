"""
MAIDAN — Cash & Manual Transfer Providers

Simple recording providers for non-digital payments.
"""

import uuid
from decimal import Decimal
from typing import Optional

from .base import PaymentProvider, PaymentResult, PaymentStatus, RefundResult


class CashProvider(PaymentProvider):
    """
    Cash payment — records cash transactions in the system.
    No external API calls.
    """

    provider_name = "cash"

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
        """Immediately records a successful cash payment."""
        transaction_id = f"CASH-{uuid.uuid4().hex[:12].upper()}"
        return PaymentResult(
            status=PaymentStatus.SUCCESS,
            transaction_id=transaction_id,
            amount=amount,
            currency=currency,
            provider=self.provider_name,
            raw_response={
                "transaction_id": transaction_id,
                "payment_method": "cash",
                "invoice_number": invoice_number,
                "received_by": metadata.get("received_by", "") if metadata else "",
            },
        )

    def verify_payment(self, transaction_id: str) -> PaymentResult:
        """Cash payments are always considered successful once recorded."""
        return PaymentResult(
            status=PaymentStatus.SUCCESS,
            transaction_id=transaction_id,
            amount=Decimal(0),
            currency="SAR",
            provider=self.provider_name,
            raw_response={"note": "Cash payment — always successful"},
        )

    def refund(self, transaction_id: str, amount: Decimal, reason: str = "") -> RefundResult:
        """Cash refunds — manually issued, recorded in system."""
        refund_id = f"CASH-REF-{uuid.uuid4().hex[:10].upper()}"
        return RefundResult(
            status=PaymentStatus.REFUNDED,
            refund_id=refund_id,
            amount=amount,
            currency="SAR",
            provider=self.provider_name,
            raw_response={"note": "Manual cash refund recorded", "reason": reason},
        )


class ManualTransferProvider(PaymentProvider):
    """
    Manual bank transfer / Sadad / STC Pay provider.
    Staff marks as paid after verifying bank receipt.
    """

    provider_name = "manual"

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
        """Creates a pending manual transfer record."""
        transaction_id = f"MAN-{uuid.uuid4().hex[:12].upper()}"
        return PaymentResult(
            status=PaymentStatus.PENDING,
            transaction_id=transaction_id,
            amount=amount,
            currency=currency,
            provider=self.provider_name,
            raw_response={
                "transaction_id": transaction_id,
                "payment_method": "manual_transfer",
                "invoice_number": invoice_number,
                "note": "Pending staff verification",
            },
        )

    def verify_payment(self, transaction_id: str) -> PaymentResult:
        """Manual verification — check DB for staff confirmation."""
        return PaymentResult(
            status=PaymentStatus.PENDING,
            transaction_id=transaction_id,
            amount=Decimal(0),
            currency="SAR",
            provider=self.provider_name,
            raw_response={"note": "Manual transfer — verify with staff"},
        )

    def refund(self, transaction_id: str, amount: Decimal, reason: str = "") -> RefundResult:
        refund_id = f"MAN-REF-{uuid.uuid4().hex[:10].upper()}"
        return RefundResult(
            status=PaymentStatus.REFUNDED,
            refund_id=refund_id,
            amount=amount,
            currency="SAR",
            provider=self.provider_name,
            raw_response={"note": "Manual refund — bank transfer initiated", "reason": reason},
        )
