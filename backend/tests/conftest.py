import pytest
from app.main import app


@pytest.fixture(autouse=True)
def reset_app_state():
    app.dependency_overrides = {}
    yield
    app.dependency_overrides = {}
