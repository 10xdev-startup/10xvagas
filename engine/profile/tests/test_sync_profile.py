from __future__ import annotations

import json
import os
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from engine.profile.sync_profile import ProfileSyncError, load_profile, main, sync_profile
from engine.supabase_rest import SupabaseRestClient


ROOT = Path(__file__).resolve().parents[3]
PROFILE_PATH = ROOT / "engine" / "experiment" / "data" / "canonical-profile.json"


class ProfileSyncTest(unittest.TestCase):
    def test_syncs_profile_for_explicit_user_only(self) -> None:
        client = Mock(spec=SupabaseRestClient)
        profile = load_profile(PROFILE_PATH)

        sync_profile("11111111-1111-4111-8111-111111111111", profile, client)

        client.request.assert_called_once()
        call = client.request.call_args
        self.assertEqual(call.args[0], "profile?on_conflict=user_id")
        self.assertEqual(call.kwargs["method"], "POST")
        self.assertEqual(
            call.kwargs["payload"]["user_id"],
            "11111111-1111-4111-8111-111111111111",
        )
        self.assertEqual(call.kwargs["payload"]["document"], profile)
        self.assertEqual(
            call.kwargs["prefer"],
            "resolution=merge-duplicates,return=minimal,missing=default",
        )

    def test_rejects_profile_without_matching_intent(self) -> None:
        with self.assertRaisesRegex(ProfileSyncError, "skills_desired"):
            sync_profile(
                "11111111-1111-4111-8111-111111111111",
                {"identity": {}},
                Mock(spec=SupabaseRestClient),
            )

    @patch("engine.profile.sync_profile.SupabaseRestClient.from_env")
    @patch.dict(os.environ, {}, clear=True)
    def test_cli_requires_explicit_user_id(self, from_env: Mock) -> None:
        with patch("sys.argv", ["sync_profile"]):
            with self.assertRaisesRegex(ProfileSyncError, "PROFILE_USER_ID"):
                main()

        from_env.assert_not_called()

    def test_load_profile_rejects_invalid_json_shape(self) -> None:
        temporary = Path(self.id().replace(".", "-") + ".json")
        try:
            temporary.write_text(json.dumps([]), encoding="utf-8")
            with self.assertRaisesRegex(ProfileSyncError, "objeto JSON"):
                load_profile(temporary)
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
