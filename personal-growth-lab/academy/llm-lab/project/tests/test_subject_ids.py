import unittest

from curatemicrobiota.evaluation import require_resolved_subject_ids


class SubjectIdentityContract(unittest.TestCase):
    def test_unresolved_subject_ids_block_person_level_evaluation(self):
        for flag in ["TRUE", "true", "1", True]:
            with self.subTest(flag=flag):
                with self.assertRaisesRegex(ValueError, "unresolved subject IDs"):
                    require_resolved_subject_ids([
                        {"subject_id": "resolved_person", "subject_id_unresolved": "FALSE"},
                        {"subject_id": "UNRESOLVED_SAMPLE_X", "subject_id_unresolved": flag},
                    ])
        require_resolved_subject_ids([
            {"subject_id": "person_a", "subject_id_unresolved": "FALSE"},
            {"subject_id": "person_b"},
        ])


if __name__ == "__main__":
    unittest.main()
