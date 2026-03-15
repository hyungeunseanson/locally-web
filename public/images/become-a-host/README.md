# Become a Host localized image guide

Put localized landing images in the folders below.

## Folder structure

- `desktop/ko/1.png` ... `desktop/ko/7.png`
- `desktop/en/1.png` ... `desktop/en/7.png`
- `desktop/ja/1.png` ... `desktop/ja/7.png`
- `desktop/zh/1.png` ... `desktop/zh/7.png`
- `mobile/ko/1.png` ... `mobile/ko/7.png`
- `mobile/en/1.png` ... `mobile/en/7.png`
- `mobile/ja/1.png` ... `mobile/ja/7.png`
- `mobile/zh/1.png` ... `mobile/zh/7.png`

## File naming rule

- Keep the same section order for every locale.
- Use exactly `1.png` to `7.png`.
- Replace only the image contents for each locale.

## Fallback behavior

- If a locale-specific image is missing, the page automatically falls back to `ko`.
- This means you can add `en`, `ja`, `zh` images gradually without breaking the page.

## Current section sizes

- `1.png`
  - desktop: `2880x1260`
  - mobile: `1740x1688`
- `2.png`
  - desktop: `2880x1434`
  - mobile: `1740x2394`
- `3.png`
  - desktop: `2880x1156`
  - mobile: `1740x1156`
- `4.png`
  - desktop: `2880x1296`
  - mobile: `1740x1296`
- `5.png`
  - desktop: `2880x1542`
  - mobile: `1740x1542`
- `6.png`
  - desktop: `2880x1502`
  - mobile: `1740x1502`
- `7.png`
  - desktop: `2880x2264`
  - mobile: `1740x2264`
