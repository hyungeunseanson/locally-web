# About Locally localized image guide

Put localized landing images in the folders below.

## Folder structure

- `desktop/ko/1.png`, `desktop/ko/2.png`, ...
- `desktop/en/1.png`, `desktop/en/2.png`, ...
- `desktop/ja/1.png`, `desktop/ja/2.png`, ...
- `desktop/zh/1.png`, `desktop/zh/2.png`, ...
- `mobile/ko/1.png`, `mobile/ko/2.png`, ...
- `mobile/en/1.png`, `mobile/en/2.png`, ...
- `mobile/ja/1.png`, `mobile/ja/2.png`, ...
- `mobile/zh/1.png`, `mobile/zh/2.png`, ...

## File naming rule

- Use numbered files like `1.png`, `2.png`, `3.png`.
- `png`, `jpg`, `jpeg`, `webp` are supported.
- Desktop and mobile must share the same numbered file set.

## Rendering rule

- The page renders image landing sections only when a locale has a complete numbered set for both `desktop/{locale}` and `mobile/{locale}`.
- A locale is activated only when its numbered file set exactly matches the Korean reference set.
- Partial uploads do not fall back to `ko`; the existing editorial `/about` page stays active until the locale is complete.

## Recommended workflow

1. Export the full landing into numbered slices.
2. Put desktop slices in `desktop/{locale}`.
3. Put mobile slices in `mobile/{locale}`.
4. Keep the same numbering across every locale.
5. Upload partial files if needed, then complete the full set to activate that locale automatically.
