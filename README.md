# 朱宝圆 · Personal website

Public website: https://zbyloveyj.github.io/

## Current information structure · November 2026

The homepage is a concise editorial introduction. Each full collection has one canonical home:

| Page | Responsibility |
|---|---|
| `research.html` | Research questions, methods and three published case studies |
| `publications.html` | Searchable bibliography, research notes and citation exports |
| `books.html` | Complete four-book catalogue and reading/download links |
| `projects.html` | Five research and teaching code projects |
| `about.html` | Biography, academic experience, writing, personal perspective and contact |
| `cv.html` | Printable academic CV, linked from About |
| `personal-growth-lab/academy/` | Learning desk; `#/projects` owns the searchable course catalogue |
| `industry-insights/` | Curated industry overview; `research/` owns the full research catalogue |

Core pages use **one stylesheet**, `assets/site-design.css`, plus the existing bilingual, theme and bibliography behaviour. App pages share `assets/site-context.css`, retaining their specialist readers and controls. The academy's learning desk uses `assets/desk.css`. Old stylesheets are retained for legacy pages, but are no longer stacked on the core editorial pages.

The homepage includes bilingual method tabs (input, method and output), a sticky section index, enlarged attributed research figures, and journal context beside the selected bibliography. `assets/home-experience.js` progressively enhances the tabs: with scripts disabled, all three method descriptions remain readable. Tabs support arrow keys, Home and End. Chinese and English entry pages share the same content and interactions.

Course content, DOI metadata, CV PDF, learning storage keys and record schemas are preserved. A lesson's availability is not a claim that the user completed it. No private MicroNorm material is added.

GitHub Pages deploys from `main` through the built-in branch-based workflow. `.github/workflows/deploy.yml` validates content and readers; it must not publish a competing Pages artifact.

## Checks

```bash
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
