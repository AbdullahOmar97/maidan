import logging

logger = logging.getLogger(__name__)

class DebugHostMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = request.get_host()
        # Log to console so we can see it in docker logs
        print(f"DEBUG HOST: {host}")
        return self.get_response(request)
