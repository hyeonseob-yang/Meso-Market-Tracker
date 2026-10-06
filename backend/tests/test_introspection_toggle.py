"""schema.py reads GRAPHQL_INTROSPECTION_ENABLED once, at import time, to
build its extension list - these tests reload the module under each setting
to exercise both branches, rather than relying on whatever happened to be
set when the test session started."""

import importlib

INTROSPECTION_QUERY = "{ __schema { types { name } } }"


def _reload_schema(monkeypatch, enabled: str | None):
    if enabled is None:
        monkeypatch.delenv("GRAPHQL_INTROSPECTION_ENABLED", raising=False)
    else:
        monkeypatch.setenv("GRAPHQL_INTROSPECTION_ENABLED", enabled)
    import schema

    return importlib.reload(schema)


def test_introspection_allowed_by_default(monkeypatch):
    schema = _reload_schema(monkeypatch, None)
    result = schema.schema.execute_sync(INTROSPECTION_QUERY)
    assert result.errors is None


def test_introspection_disabled_when_flag_is_false(monkeypatch):
    schema = _reload_schema(monkeypatch, "false")
    result = schema.schema.execute_sync(INTROSPECTION_QUERY)
    assert result.errors is not None
    assert any("introspection" in e.message.lower() for e in result.errors)
