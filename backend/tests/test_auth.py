import time
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

import auth
from auth import get_current_user


def _generate_key_pair():
    private_key = ec.generate_private_key(ec.SECP256R1())
    return private_key, private_key.public_key()


PRIVATE_KEY, PUBLIC_KEY = _generate_key_pair()
OTHER_PRIVATE_KEY, _ = _generate_key_pair()


def _make_info(auth_header=None):
    request = MagicMock()
    headers = {} if auth_header is None else {"Authorization": auth_header}
    request.headers.get.side_effect = lambda key, default=None: headers.get(key, default)
    info = MagicMock()
    info.context = {"request": request}
    return info


def _make_token(sub="user-123", email="test@example.com", private_key=PRIVATE_KEY, **extra_claims):
    return jwt.encode(
        {"sub": sub, "email": email, "aud": "authenticated", **extra_claims}, private_key, algorithm="ES256"
    )


@pytest.fixture(autouse=True)
def mock_jwks(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://test-project.supabase.co")
    auth._jwks_client = None  # reset the module-level cache between tests
    fake_client = MagicMock()
    fake_client.get_signing_key_from_jwt.return_value = SimpleNamespace(key=PUBLIC_KEY)
    with patch("auth._get_jwks_client", return_value=fake_client):
        yield


def test_get_current_user_returns_none_without_header():
    assert get_current_user(_make_info()) is None


def test_get_current_user_returns_none_without_bearer_prefix():
    assert get_current_user(_make_info("not-a-bearer-token")) is None


def test_get_current_user_returns_none_when_supabase_url_unset(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    token = _make_token()
    assert get_current_user(_make_info(f"Bearer {token}")) is None


def test_get_current_user_returns_user_for_valid_token():
    token = _make_token()
    assert get_current_user(_make_info(f"Bearer {token}")) == {"id": "user-123", "email": "test@example.com"}


def test_get_current_user_returns_none_for_expired_token():
    token = _make_token(exp=int(time.time()) - 60)
    assert get_current_user(_make_info(f"Bearer {token}")) is None


def test_get_current_user_returns_none_for_token_signed_by_different_key():
    # Simulates a forged token, or one signed by a key the JWKS endpoint
    # no longer serves (e.g. after rotation).
    token = _make_token(private_key=OTHER_PRIVATE_KEY)
    assert get_current_user(_make_info(f"Bearer {token}")) is None


def test_get_current_user_returns_none_for_garbage_token():
    assert get_current_user(_make_info("Bearer not-a-real-jwt")) is None
