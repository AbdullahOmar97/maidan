"""
MAIDAN — Payment Provider Abstraction

Clean, extensible payment provider system using Abstract Base Class.
Providers: PayTabs, HyperPay, Stripe, Cash, Manual Transfer.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Optional

logger = logging.getLogger("maidan.payments")


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


@dataclass
class PaymentResult:
    """Standardized payment result across all providers."""

    status: PaymentStatus
    transaction_id: str
    amount: Decimal
    currency: str
    provider: str
    raw_response: dict
    redirect_url: Optional[str] = None  # For redirect-based flows (PayTabs, HyperPay)
    error_message: Optional[str] = None
    receipt_url: Optional[str] = None
    metadata: Optional[dict] = None


@dataclass
class RefundResult:
    status: PaymentStatus
    refund_id: str
    amount: Decimal
    currency: str
    provider: str
    raw_response: dict
    error_message: Optional[str] = None


class PaymentProvider(ABC):
    """
    Abstract base for all payment providers.
    All providers must implement these three methods.
    """

    provider_name: str = "base"

    @abstractmethod
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
        """Initiate a payment. Returns redirect URL or transaction ID."""
        ...

    @abstractmethod
    def verify_payment(self, transaction_id: str) -> PaymentResult:
        """Verify the status of a payment by transaction ID."""
        ...

    @abstractmethod
    def refund(
        self,
        transaction_id: str,
        amount: Decimal,
        reason: str = "",
    ) -> RefundResult:
        """Issue a full or partial refund."""
        ...

    def format_amount(self, amount: Decimal) -> str:
        """Format amount to 2 decimal places string for APIs."""
        return f"{amount:.2f}"
