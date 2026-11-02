import time
from unittest.mock import MagicMock

import jwt

from auth import get_current_user

TEST_SECRET = "test-jwt-secret"


def _make_info(auth_header=None):
    request = MagicMock()
    headers = {} if auth_header is None else {"Authorization": auth_header}
    request.headers.get.side_effect = lambda key, default=None: headers.get(key, default)
    info = MagicMock()
    info.context = {"request": request}
    return info


def _make_token(sub="user-123", email="test@example.com", secret=TEST_SECRET, **extra_claims):
    return jwt.encode({"sub": sub, "email": email, "aud": "authenticated", **extra_claims}, secret, algorithm="HS256")


def test_get_current_user_returns_none_without_header():
    assert get_current_user(_make_info()) is None


def test_get_current_user_returns_none_without_bearer_prefix():
    assert get_current_user(_make_info("not-a-bearer-token")) is None


def test_get_current_user_returns_none_when_secret_unset(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    token = _make_token()
    assert get_current_user(_make_info(f"Bearer {token}")) is None


def test_get_current_user_returns_user_for_valid_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    token = _make_token()
    assert get_current_user(_make_info(f"Bearer {token}")) == {"id": "user-123", "email": "test@example.com"}


def test_get_current_user_returns_none_for_expired_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    token = _make_token(exp=int(time.time()) - 60)
    assert get_current_user(_make_info(f"Bearer {token}")) is None


def test_get_current_user_returns_none_for_wrong_secret(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    token = _make_token(secret="wrong-secret")
    assert get_current_user(_make_info(f"Bearer {token}")) is None


def test_get_current_user_returns_none_for_garbage_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    assert get_current_user(_make_info("Bearer not-a-real-jwt")) is None
