from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()

class CaseInsensitiveModelBackend(ModelBackend):
    def authenticate(self, request, email=None, password=None, **kwargs):
        if email is None:
            email = kwargs.get(User.USERNAME_FIELD)
        
        try:
            # Case-insensitive lookup
            user = User.objects.get(**{f"{User.USERNAME_FIELD}__iexact": email})
        except User.DoesNotExist:
            # Run the default password hasher once to reduce the timing
            # difference between an existing and a nonexistent user.
            User().set_password(password)
        else:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        return None
