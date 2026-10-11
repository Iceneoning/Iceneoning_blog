# Noto Sans SC — local web font

This blog uses Noto Sans SC for Chinese text, paired with its existing Roboto Latin font.

- Authoritative project: https://github.com/notofonts/noto-cjk
- Distribution: Google Fonts, Noto Sans SC v41 CSS, weight range 400–800.
- License: SIL Open Font License 1.1; see the accompanying `OFL.txt`.
- The official WOFF2 files are copied unchanged. No glyph, font name, outline, or weight-axis modification was made.
- `src/styles/fonts/noto-sans-sc.css` preserves the supplied Unicode ranges and points at local files, so browsers request only slices needed by the rendered text.
- Full source URLs, byte sizes and SHA256 hashes are recorded in `docs/美化方案/V0.3_晴空冰晶折射/背景美术研究/BG-00J_原字体回正/字体来源与哈希.json`.

The complete local collection is 4,500,544 bytes across 101 WOFF2 slices; this is not the amount downloaded by every page.
