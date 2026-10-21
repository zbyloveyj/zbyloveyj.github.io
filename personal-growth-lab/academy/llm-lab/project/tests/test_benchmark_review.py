"""Independent review regression for the newly trainable benchmark branches."""
from dataclasses import asdict
from pathlib import Path
import tempfile
import unittest

import torch

from curatemicrobiota.benchmark import supervised_fit
from curatemicrobiota.data import Cohort, Preprocessor, load_cohort, make_demo
from curatemicrobiota.microbiome import MaskedMicrobiomeEncoder, MicrobiomeConfig


class SupervisedSelectionIsolationTests(unittest.TestCase):
    def test_outer_test_labels_do_not_select_supervised_checkpoint(self):
        """Changing every test outcome must leave fitted weights and selection identical."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            make_demo(root / "data")
            cohort = load_cohort(root / "data")
            indices = cohort.indices()
            preprocessing = Preprocessor.fit(cohort.values[indices["train"]], cohort.taxa)
            features, _ = preprocessing.transform(cohort.values, cohort.taxa)
            torch.manual_seed(17)
            config = MicrobiomeConfig(taxa=features.shape[1], width=16, heads=4,
                                     layers=1, dropout=0.1)
            encoder = MaskedMicrobiomeEncoder(config)
            checkpoint = root / "encoder.pt"
            torch.save({"config": asdict(config), "state_dict": encoder.state_dict()}, checkpoint)

            changed = [dict(row) for row in cohort.metadata]
            for index in indices["test"]:
                changed[index]["label"] = str(1 - int(changed[index]["label"]))
            alternate = Cohort(cohort.values, cohort.taxa, changed, cohort.split)
            first = supervised_fit(checkpoint, features, cohort, indices,
                                   root / "first", steps=4, seed=314)
            second = supervised_fit(checkpoint, features, alternate, indices,
                                    root / "second", steps=4, seed=314)

            self.assertEqual(first["selected_step"], second["selected_step"])
            self.assertEqual(first["history"], second["history"])
            self.assertEqual(first["validation_subject_metrics"], second["validation_subject_metrics"])
            first_state = torch.load(root / "first/classifier.pt", weights_only=True)["state_dict"]
            second_state = torch.load(root / "second/classifier.pt", weights_only=True)["state_dict"]
            for name in first_state:
                self.assertTrue(torch.equal(first_state[name], second_state[name]), name)
            for before, after in zip(first["test_predictions"], second["test_predictions"]):
                self.assertEqual(before["subject_id"], after["subject_id"])
                self.assertEqual(before["probability"], after["probability"])
                self.assertEqual(before["label"], 1 - after["label"])


if __name__ == "__main__":
    unittest.main()
