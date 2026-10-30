"""
MAIDAN — Shared Security Validators

Implements strict server-side validation for uploaded files and media
following OWASP File Upload Cheat Sheet & 2026 security standards.
"""

import os
import uuid
from django.core.exceptions import ValidationError
from PIL import Image

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_IMAGE_FORMATS = {"PNG", "JPEG", "WEBP"}
ALLOWED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_IMAGE_PIXELS = 25_000_000  # 25 MP decompression bomb guard


def validate_secure_image_upload(file_obj, max_size_mb: int = 5):
    """
    Validate an uploaded image file:
    1. Enforce size limit (default 5MB) to prevent DoS.
    2. Validate file extension against strict allow-list.
    3. Inspect content/magic bytes & image structure via Pillow (and python-magic if available).
    4. Guard against image decompression bombs.
    """
    if not file_obj:
        return file_obj

    max_bytes = max_size_mb * 1024 * 1024
    if getattr(file_obj, "size", 0) > max_bytes:
        raise ValidationError(
            f"حجم الملف يتجاوز الحد الأقصى المسموح به ({max_size_mb} ميجابايت)."
        )

    filename = getattr(file_obj, "name", "") or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            "نوع الملف غير مدعوم. يُسمح فقط بصور PNG و JPG و WEBP."
        )

    # Optional python-magic check if libmagic is installed
    try:
        import magic  # type: ignore

        file_obj.seek(0)
        header_bytes = file_obj.read(2048)
        file_obj.seek(0)
        detected_mime = magic.from_buffer(header_bytes, mime=True)
        if detected_mime not in ALLOWED_IMAGE_MIMES:
            raise ValidationError(
                "محتوى الملف الفعلي لا يتطابق مع صيغة صورة صالحة."
            )
    except ImportError:
        pass
    except ValidationError:
        raise
    except Exception:
        pass

    # Structural image verification via Pillow
    try:
        file_obj.seek(0)
        img = Image.open(file_obj)
        img_format = (img.format or "").upper()
        width, height = img.size
        if width * height > MAX_IMAGE_PIXELS:
            raise ValidationError("أبعاد الصورة كبيرة جداً وغير مسموح بها أمنياً.")
        img.verify()
        file_obj.seek(0)
    except ValidationError:
        raise
    except Exception:
        raise ValidationError("الملف المرفوع تالف أو ليس صورة صالحة.")

    if img_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError("صيغة الصورة غير مدعومة. يُسمح فقط بـ PNG و JPEG و WEBP.")

    # TODO(security): Integrate ClamAV / CDR active-content stripping in production media pipeline.
    return file_obj


def avatar_upload_path(instance, filename: str) -> str:
    """
    Generate an unpredictable UUID filename for user avatars to prevent
    path traversal and filename enumeration.
    """
    ext = os.path.splitext(os.path.basename(filename))[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        ext = ".png"
    return f"avatars/{uuid.uuid4().hex}{ext}"
