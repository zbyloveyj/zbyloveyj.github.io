# 朱宝圆 · Personal website

Public website: https://zbyloveyj.github.io/

## Current information structure · November 2026

The homepage is an orientation page. Complete collections have one canonical home:

| Destination | Responsibility |
|---|---|
| `research.html` | Research questions, methods and three complete case studies |
| `publications.html` | Ten selected publication records, filters, notes and citation exports |
| `projects.html` | Five code projects with scope and links to their related research |
| `books.html` | Four online works, with contents and reading/download destinations |
| `about.html` | Biography, education, recognition and contact; links to the English printable CV |
| `personal-growth-lab/academy/` | Canonical learning home; `#/projects` is the course catalogue, `#/journal` records, `#/resources` tools and resources |
| `personal-growth-lab/` | The original 21-day speaking course, not a second academy home |
| `industry-insights/` | Industry overview; `research/` holds the complete article catalogue; `latest.html` is the current report |
| `directory.html` | Searchable, categorized directory of research, books, courses and tools |

`assets/site-directory.json` owns directory entries. `tools/sync_navigation.py` generates the directory and shared navigation for core pages and course/reader entry pages. Run it after editing an entry page or rebuilding industry articles, then run the existing validations. Header links and the compact parent navigation must not drift into competing site hierarchies.

`index-en.html` and `index-zh.html` remain compatible language aliases and preserve query parameters and fragments. The homepage content is maintained only in `index.html`. Core pages share `assets/site-design.css`; specialist readers share only the compact `assets/site-context.css` parent navigation and retain their own controls.

Course source, DOI metadata, CV PDF, storage keys and record schemas are preserved. The 30-day generalist plan distinguishes released structured lessons, seven preliminary Markdown drafts and planned material; drafts are readable but do not unlock completion. Material availability never means a lesson was completed by the user. Private MicroNorm material is not included.

GitHub Pages deploys from `main` through its built-in workflow. Validation workflows must not publish a competing Pages artifact.

## Checks

```bash
python3 tools/sync_navigation.py
python3 tests/validate_site.py
node --check assets/site.js
node --check personal-growth-lab/academy/assets/app.js
node personal-growth-lab/academy/tools/validate.js --full-catalog
python3 industry-insights/tools/validate.py
```

## Source/claim safety

The site uses only public scholarly identity, institutional affiliation, previously provided contact email, verified DOI records and public GitHub repositories. It does **not** disclose date of birth, telephone number, personal home address, health records, private research subject records or unannounced grant information. The 18-publication and 9-lead-paper snapshot is from an October 2026 academic CV and **is not** an automatically updated citation count. The 20,178 metagenome and 36-country figures refer to a specific *Advanced Science* study, not direct recruitment by a single researcher.

Selected records should not be mistaken for a complete, live author bibliography. Refer to the ORCID record: <https://orcid.org/0009-0006-6213-214X>.

© 2026 Baoyuan Zhu. Website content and code are supplied for the website owner's use. Rights to published paper text/images remain with the respective rights holders.
