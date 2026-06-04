"""Unit tests for session ownership checks."""

import unittest
from dataclasses import dataclass

from fastapi import HTTPException

from src.server.session_auth import assert_session_owner


@dataclass
class _FakeSession:
    user_id: str | None


class TestAssertSessionOwner(unittest.TestCase):
    def test_allows_owner(self) -> None:
        assert_session_owner(_FakeSession(user_id="user-a"), "user-a")

    def test_allows_legacy_session_without_user_id(self) -> None:
        assert_session_owner(_FakeSession(user_id=None), "user-a")

    def test_allows_legacy_mapping_without_user_id(self) -> None:
        assert_session_owner({"thread_id": "t1"}, "user-a")

    def test_denies_other_user(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            assert_session_owner({"user_id": "user-a", "thread_id": "t1"}, "user-b")
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
