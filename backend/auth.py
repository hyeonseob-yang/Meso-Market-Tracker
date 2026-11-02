import os

import jwt
from strawberry.types import Info


def get_current_user(info: Info) -> dict | None:
    """Verifies the Supabase-issued bearer token, if present. Returns None
    for a missing/invalid/expired token rather than raising - most
    resolvers stay public regardless of whether a user is logged in."""
    auth_header = info.context["request"].headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ")
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        return None

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
    except jwt.PyJWTError:
        return None

    return {"id": payload["sub"], "email": payload["email"]}
