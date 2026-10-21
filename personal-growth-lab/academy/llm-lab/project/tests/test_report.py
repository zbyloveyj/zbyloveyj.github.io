"""Check the persisted report contract without repeating model training."""
from contextlib import ExitStack, redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from curatemicrobiota import __version__
from curatemicrobiota.__main__ import main


class ReportContracts(unittest.TestCase):
    def test_pipeline_persists_the_running_package_version(self):
        # Data generation, CLI handling and report serialization remain real;
        # only costly model-training/evaluation components are stubbed.
        components = [
            "curatemicrobiota.language.train_language",
            "curatemicrobiota.microbiome.pretrain_microbiome",
            "curatemicrobiota.evaluation.evaluate_microbiome",
            "curatemicrobiota.lora.lora_demo",
        ]
        stdout = io.StringIO()
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            for component in components:
                stack.enter_context(patch(component, return_value={"test_stub": True}))
            with redirect_stdout(stdout), redirect_stderr(io.StringIO()):
                status = main(["pipeline", "--quick", "--out", directory])
            persisted = json.loads((Path(directory) / "report.json").read_text(encoding="utf-8"))
            displayed = json.loads(stdout.getvalue())
            self.assertEqual(status, 0)
            self.assertEqual(persisted["version"], __version__)
            self.assertEqual(displayed, persisted)
            self.assertEqual(persisted["data"]["samples"], 240)
            self.assertEqual(persisted["source_kind"], "synthetic_teaching_fixture")


if __name__ == "__main__":
    unittest.main()
