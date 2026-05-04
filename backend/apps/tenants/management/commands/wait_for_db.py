"""
MAIDAN — wait_for_db Management Command
Waits for the database to be ready before starting Django.
"""

import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = "Wait for database to become available"

    def add_arguments(self, parser):
        parser.add_argument("--timeout", type=int, default=60, help="Timeout in seconds")

    def handle(self, *args, **options):
        timeout = options["timeout"]
        self.stdout.write("Waiting for database...")
        start = time.time()

        while True:
            try:
                connections["default"].ensure_connection()
                self.stdout.write(self.style.SUCCESS("Database is ready!"))
                return
            except OperationalError:
                elapsed = time.time() - start
                if elapsed > timeout:
                    self.stderr.write(self.style.ERROR(f"Database not available after {timeout}s. Exiting."))
                    raise SystemExit(1)
                self.stdout.write(f"Database not ready, retrying... ({elapsed:.0f}s)")
                time.sleep(2)
