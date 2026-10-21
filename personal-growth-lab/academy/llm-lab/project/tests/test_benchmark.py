import tempfile
import unittest

from curatemicrobiota.benchmark import loso_splits, select_training_labels, paired_auroc_difference
from curatemicrobiota.data import make_demo, load_cohort, validate_split


class StudyBenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        make_demo(self.directory.name)
        self.cohort = load_cohort(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def test_every_study_is_test_once_and_subjects_never_cross(self):
        splits = loso_splits(self.cohort.metadata)
        self.assertEqual(len(splits), 6)
        self.assertEqual(len({s["test"][0] for s in splits}), 6)
        for split in splits:
            indices = validate_split(self.cohort.metadata, split)
            self.assertEqual([len(indices[s]) for s in ["train", "val", "test"]], [160, 40, 40])

    def test_cross_study_subject_requires_explicit_grouping(self):
        rows = [dict(r) for r in self.cohort.metadata]
        rows[-1]["subject_id"] = rows[0]["subject_id"]
        with self.assertRaisesRegex(ValueError, "spans studies"):
            loso_splits(rows)

    def test_label_budget_is_subject_level_and_never_alters_heldout(self):
        split = loso_splits(self.cohort.metadata)[0]
        rows, selected = select_training_labels(self.cohort.metadata, split, 0.5, seed=42)
        self.assertEqual(len(selected), 40)  # 80 train people, not 160 independent visits.
        by_subject = {}
        for source, row in zip(self.cohort.metadata, rows):
            if source["study"] not in split["train"]:
                self.assertEqual(source, row)
            else:
                by_subject.setdefault(row["subject_id"], set()).add(row["label"])
        self.assertTrue(all(len(labels) == 1 for labels in by_subject.values()))
        self.assertEqual(sum(labels != {""} for labels in by_subject.values()), 40)
        self.assertEqual(select_training_labels(self.cohort.metadata, split, 0.5, 42)[1], selected)

    def test_invalid_label_budget_and_changing_subject_labels_rejected(self):
        split = loso_splits(self.cohort.metadata)[0]
        with self.assertRaises(ValueError):
            select_training_labels(self.cohort.metadata, split, 0, 42)
        rows = [dict(r) for r in self.cohort.metadata]
        i = next(i for i, r in enumerate(rows) if r["study"] in split["train"])
        rows[i]["label"] = str(1 - int(rows[i]["label"]))
        with self.assertRaisesRegex(ValueError, "Inconsistent"):
            select_training_labels(rows, split, 0.5, 42)

    def test_paired_comparison_matches_subject_ids_not_row_order(self):
        rows = [{"subject_id": f"p{i}", "label": i % 2, "probability": (0.2 if i % 2 == 0 else 0.8)}
                for i in range(10)]
        result = paired_auroc_difference(rows, list(reversed(rows)), draws=50)
        self.assertEqual(result["difference"], 0)
        self.assertEqual(result["ci95"], [0, 0])
        with self.assertRaises(ValueError):
            paired_auroc_difference(rows, rows[:-1])
        broken = [dict(r) for r in rows]
        broken[0]["label"] = 1
        with self.assertRaisesRegex(ValueError, "labels differ"):
            paired_auroc_difference(rows, broken)

    def test_one_class_has_no_auc_or_invented_interval(self):
        rows = [{"subject_id": f"p{i}", "label": 0, "probability": 0.1 * i} for i in range(4)]
        result = paired_auroc_difference(rows, rows, draws=50)
        self.assertIsNone(result["difference"])
        self.assertIsNone(result["ci95"])


if __name__ == "__main__":
    unittest.main()
