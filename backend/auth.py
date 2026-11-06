import os

import jwt
from strawberry.types import Info

_jwks_client: jwt.PyJWKClient | None = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = os.environ["SUPABASE_URL"].rstrip("/")
        _jwks_client = jwt.PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json")
    return _jwks_client


def get_current_user(info: Info) -> dict | None:
    """Verifies the Supabase-issued bearer token, if present, against
    Supabase's public signing key (ECC/ES256) - fetched from its JWKS
    endpoint and cached across invocations. Returns None for any
    missing/invalid/expired/unverifiable token rather than raising -
    most resolvers stay public regardless of login state."""
    auth_header = info.context["request"].headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    if "SUPABASE_URL" not in os.environ:
        return None

    token = auth_header.removeprefix("Bearer ")
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(token, signing_key.key, algorithms=["ES256"], audience="authenticated")
    except Exception:
        return None

    return {"id": payload["sub"], "email": payload["email"]}
