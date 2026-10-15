# Baoyuan Zhu — Academic Homepage

**Independent bilingual academic website** for Baoyuan Zhu / 朱宝圆, PhD candidate at South China University of Technology. Built as a static GitHub Pages site with **no framework, external font, cookies, analytics, or tracking**.

The canonical public address, **after setup**, will be <https://zbyloveyj.github.io/>. The site is not live until the user creates and enables the corresponding `zbyloveyj.github.io` GitHub repository.

## What is included

| Page | Content |
|---|---|
| `index.html` | Academic biography, research snapshots, updates, publications and research tools |
| `research.html` | Four research themes and three paper-linked case studies |
| `publications.html` | Ten DOI-linked selected papers, summary notes, keyword/year filters, CSV and BibTeX/RIS exports |
| `projects.html` | Five linked public GitHub research/education projects and science writing |
| `cv.html` | Printable CV, with a separate offline PDF in `assets/` |
| `404.html` | Return-to-home page |

**Design:** English-first with Chinese translation, light/dark switch, typography-led illustrations, responsive desktop/tablet/mobile layout, semantic headings, skip navigation and accessibility affordances. Language and theme preferences are saved only in the viewer's browser.

**Metadata:** JSON-LD profile, Open Graph sharing image, canonical tags, sitemap and robots.txt. Citation files include full author lists and correct DOI links obtained from publisher and PubMed pages. No unpublished manuscripts are represented as published.

## Local preview

Open `index.html` in a browser. All data and graphics are local, and no server-side application is needed. The DOI/GitHub links require Internet access.

## Publish to the GitHub account `zbyloveyj`

1. Visit <https://github.com/new?name=zbyloveyj.github.io> and create the **public** repository `zbyloveyj.github.io` under your account. Do not select a different repository name if you want the clean root URL.
2. Upload **the contents of this folder** to the repository's `main` branch, so `index.html` sits at repository root. Do not upload the enclosing ZIP as a single file.
3. Open repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. If Pages is already configured correctly, this may already be selected.
4. The included `.github/workflows/deploy.yml` runs validation and deploys the static site to <https://zbyloveyj.github.io/> on subsequent pushes to `main`.
5. Verify the home page, `research.html`, `publications.html`, `projects.html` and `cv.html` on desktop/mobile. DNS/CDN updates may not be immediate.

An expanded Chinese guide is in `DEPLOY_GUIDE_中文.md`.

## Content edits

- **Paper records, display citations and GitHub repository cards**: `assets/data.js`. Update `assets/Baoyuan_Zhu_Selected_Publications.bib` and `.ris` as well when paper metadata changes.
- **Home / research / publications / projects text**: corresponding `.html` files.
- **Styles**: `assets/style.css`, `assets/polish.css`, `assets/v3.css`.
- **Interactions**: `assets/site.js`, `assets/v3.js`.
- **CV**: edit `cv.html`, then regenerate/review the PDF; the PDF is a fixed snapshot, not an automatic rendering of data.js.
- **Public academic facts**: record status and verification URL in `CONTENT_AUDIT.md`.

Run validation before every release:

```bash
python3 tests/validate_site.py
node --check assets/data.js
node --check assets/site.js
node --check assets/v3.js
```

## Source/claim safety

The site uses only public scholarly identity, institutional affiliation, previously provided contact email, verified DOI records and public GitHub repositories. It does **not** disclose date of birth, telephone number, personal home address, health records, private research subject records or unannounced grant information. The 18-publication and 9-lead-paper snapshot is from an October 2026 academic CV and **is not** an automatically updated citation count. The 20,178 metagenome and 36-country figures refer to a specific *Advanced Science* study, not direct recruitment by a single researcher.

Selected records should not be mistaken for a complete, live author bibliography. Refer to the ORCID record: <https://orcid.org/0009-0006-6213-214X>.

© 2026 Baoyuan Zhu. Website content and code are supplied for the website owner's use. Rights to published paper text/images remain with the respective rights holders.
