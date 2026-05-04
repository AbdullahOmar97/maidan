"""
MAIDAN — Custom Exception Handler
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger("maidan")


def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler that returns consistent error format:
    {
        "error": {
            "code": "validation_error",
            "message": "One or more fields are invalid.",
            "detail": {...}
        }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_code = "error"
        message = "An error occurred."

        if response.status_code == status.HTTP_400_BAD_REQUEST:
            error_code = "validation_error"
            message = "One or more fields are invalid."
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            error_code = "authentication_failed"
            message = "Authentication credentials were not provided or are invalid."
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            error_code = "permission_denied"
            message = "You do not have permission to perform this action."
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            error_code = "not_found"
            message = "The requested resource was not found."
        elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            error_code = "rate_limited"
            message = "Too many requests. Please slow down."
        elif response.status_code >= 500:
            error_code = "server_error"
            message = "An internal server error occurred."
            logger.error(f"Server error in {context['view'].__class__.__name__}: {exc}")

        response.data = {
            "error": {
                "code": error_code,
                "message": message,
                "detail": response.data,
            }
        }

    return response
