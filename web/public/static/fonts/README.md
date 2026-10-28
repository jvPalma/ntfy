# Fonts (fork)

Subset `woff2` files generated once with fontTools 4.68.0 and committed. Sources: the "ntfy jv" Android fork's `app/src/main/res/font/` (IBM Plex Sans from Google Fonts, JetBrains Mono Nerd Font from `~/.fonts/JetbrainsNerdFonts`).

Ranges: Basic Latin, Latin-1, Latin Extended-A, General Punctuation, `€`. The mono files also keep the two Nerd Font glyphs the app uses: `U+F018F` (content_copy) and `U+F012C` (check).

```bash
SRC=~/projects/ntfy-android/app/src/main/res/font
R="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2000-206F,U+20AC"
sub() { uvx --from 'fonttools[woff]==4.68.0' pyftsubset "$1" --unicodes="$2" --flavor=woff2 --layout-features='*' --output-file="$3"; }
sub $SRC/ibm_plex_sans_variable.ttf        "$R"                  ibm-plex-sans-variable.woff2
sub $SRC/ibm_plex_sans_italic_variable.ttf "$R"                  ibm-plex-sans-italic-variable.woff2
sub $SRC/jetbrains_mono_nf_regular.ttf     "$R,U+F018F,U+F012C"  jetbrains-mono-nf-regular.woff2
sub $SRC/jetbrains_mono_nf_bold.ttf        "$R,U+F018F,U+F012C"  jetbrains-mono-nf-bold.woff2
```

To add a Nerd Font glyph, append its code point to the two mono lines and run them again.
