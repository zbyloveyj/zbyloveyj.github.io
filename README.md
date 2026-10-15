# Baoyuan Zhu — Academic Homepage

**Independent bilingual academic website** for Baoyuan Zhu / 朱宝圆, PhD candidate at South China University of Technology. Built as a static GitHub Pages site with **no framework, external font, cookies, analytics, or tracking**.

**Public academic homepage:** <https://zbyloveyj.github.io/>. The first GitHub Pages build and deployment completed successfully on 2026-10-15. The academic homepage is hosted at the account-root URL, independently of other repositories.

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

## Deployment and maintenance

The repository `zbyloveyj/zbyloveyj.github.io` is now public and contains the complete V3 site, bibliography exports, PDF CV, illustrations and GitHub Actions workflow. The first Pages deployment [succeeded](https://github.com/zbyloveyj/zbyloveyj.github.io/actions/runs/38733330834). The prior repository README was retained as `archive/README_before_academic_homepage.md`.

Updates to `main` automatically run content validation and redeploy the site through `.github/workflows/deploy.yml`. Verify the following pages after making changes:

- <https://zbyloveyj.github.io/>
- <https://zbyloveyj.github.io/research.html>
- <https://zbyloveyj.github.io/publications.html>
- <https://zbyloveyj.github.io/projects.html>
- <https://zbyloveyj.github.io/cv.html>

The Chinese deployment guide is in `DEPLOY_GUIDE_中文.md`.

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

## Editorial UX update (V4 · 2026-10-15)

- A one-click CV item in the global navigation; larger scholarly text and improved responsive navigation.
- Publication title links now open verified journal DOIs, with dedicated clear/reset search controls.
- The open `graduate-research-handbook/` has been surfaced on Home and Open Science and is published alongside the core site. It is a **work-in-progress educational resource**, not a peer-reviewed paper; chapter availability is managed by its catalog.
- Editorial styling is isolated in `assets/editorial-v4.css` to make future maintenance easier.
- The source DOI list, contribution statements and existing academic research content remain unchanged.

## GitHub profile staging and publishing (October 2026)

- The designed bilingual GitHub Profile README, adaptive banners and source files are in [`github-profile/`](github-profile/README.md). A public design preview is available at <https://zbyloveyj.github.io/github-profile/>.
- **Important:** GitHub only renders a Profile README on the account Overview after creating a separate public repository named exactly `zbyloveyj/zbyloveyj` and placing the staged README and its `assets/` folder at its root. The preview alone does not change the GitHub account Overview.
- GitHub Pages currently publishes this site through the **built-in branch-based** Pages workflow. `.github/workflows/deploy.yml` now performs validation only, avoiding duplicate Pages deployment errors. If Pages source settings are deliberately changed later, update the publishing workflow accordingly.
