"""
Django Management Command: migrate_media_to_minio
Migrates all local media files from settings.MEDIA_ROOT into MinIO / S3 bucket.
"""

import os
import mimetypes
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
import boto3
from botocore.exceptions import ClientError


class Command(BaseCommand):
    help = "Migrates local filesystem media files to MinIO / S3 object storage."

    def add_arguments(self, parser):
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Overwrite existing files in the MinIO bucket.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate the migration without uploading files.",
        )

    def handle(self, *args, **options):
        media_root = Path(settings.MEDIA_ROOT)
        bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "maidan-media")
        endpoint_url = getattr(settings, "AWS_S3_ENDPOINT_URL", "http://minio:9000")
        access_key = getattr(settings, "AWS_ACCESS_KEY_ID", None)
        secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
        region = getattr(settings, "AWS_S3_REGION_NAME", "us-east-1")
        overwrite = options["overwrite"]
        dry_run = options["dry_run"]

        self.stdout.write(self.style.NOTICE(f"Media Root: {media_root}"))
        self.stdout.write(self.style.NOTICE(f"Target Bucket: {bucket_name} on {endpoint_url}"))

        if not media_root.exists() or not any(media_root.iterdir()):
            self.stdout.write(self.style.WARNING(f"No media directory or files found at {media_root}. Nothing to migrate."))
            return

        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )

        # Ensure bucket exists
        try:
            s3.head_bucket(Bucket=bucket_name)
        except ClientError:
            if not dry_run:
                self.stdout.write(self.style.NOTICE(f"Creating bucket '{bucket_name}'..."))
                s3.create_bucket(Bucket=bucket_name)
            else:
                self.stdout.write(self.style.NOTICE(f"[Dry-run] Would create bucket '{bucket_name}'"))

        uploaded_count = 0
        skipped_count = 0
        total_bytes = 0

        for root, _, files in os.walk(media_root):
            for file_name in files:
                file_path = Path(root) / file_name
                rel_path = file_path.relative_to(media_root).as_posix()

                # Check if already exists in MinIO
                if not overwrite:
                    try:
                        s3.head_object(Bucket=bucket_name, Key=rel_path)
                        skipped_count += 1
                        continue
                    except ClientError:
                        pass  # Object does not exist, proceed to upload

                content_type, _ = mimetypes.guess_type(str(file_path))
                extra_args = {}
                if content_type:
                    extra_args["ContentType"] = content_type

                file_size = file_path.stat().st_size
                total_bytes += file_size

                if dry_run:
                    self.stdout.write(f"[Dry-run] Would upload: {rel_path} ({file_size} bytes)")
                else:
                    self.stdout.write(f"Uploading: {rel_path}...")
                    with open(file_path, "rb") as f:
                        s3.upload_fileobj(f, bucket_name, rel_path, ExtraArgs=extra_args)

                uploaded_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nMigration complete: {uploaded_count} uploaded, {skipped_count} skipped. "
            f"Total data migrated: {total_bytes / (1024 * 1024):.2f} MB."
        ))
