"""Dummy test to verify pytest setup works correctly."""


class TestDummy:
    """Dummy test class."""

    def test_always_passes(self) -> None:
        """A test that always passes to verify CI setup."""
        assert True

    def test_simple_math(self) -> None:
        """Test simple math operations."""
        assert 1 + 1 == 2
        assert 2 * 3 == 6
        assert 10 - 5 == 5
