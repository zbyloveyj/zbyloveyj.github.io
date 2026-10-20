#!/usr/bin/env python3
"""Publication entry point with final pagination refinements."""
import build_workbooks as publication
# Keep the rubric and its interpretation together instead of leaving a short
# explanatory paragraph alone on a near-empty page before the check-in sheet.
publication.CSS += '\n.scoring{break-inside:avoid}.scoring + p{break-before:avoid}\n'
if __name__ == '__main__':
    publication.main()
