# Versioned site fonts

These four unmodified Latin WOFF2 assets are byte-identical to the site's
previous Google-font export. They cover the Spanish and English interface,
including accents. Playfair Display and DM Sans are variable fonts; Space Mono
has separate regular and bold files. Other scripts use the existing system
fallbacks. KaTeX retains its own fonts.

`sources.json` records the official Google Fonts URLs, SHA256 values, sizes and
previous exported asset names. Each family's SIL Open Font License is included.
Next's local loader emits and preloads these assets without requesting Google
during a build. The previous fallback metric overrides are preserved in
`../font-fallbacks.css`.
