---
name: PolicyLens Narrative
colors:
  surface: '#faf9fc'
  surface-dim: '#dad9dd'
  surface-bright: '#faf9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f7'
  surface-container: '#eeedf1'
  surface-container-high: '#e9e7eb'
  surface-container-highest: '#e3e2e6'
  on-surface: '#1a1c1e'
  on-surface-variant: '#43474e'
  inverse-surface: '#2f3033'
  inverse-on-surface: '#f1f0f4'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#455f87'
  primary: '#022448'
  on-primary: '#ffffff'
  primary-container: '#1e3a5f'
  on-primary-container: '#8aa4cf'
  inverse-primary: '#adc8f5'
  secondary: '#665e41'
  on-secondary: '#ffffff'
  secondary-container: '#eee2bd'
  on-secondary-container: '#6d6447'
  tertiary: '#122439'
  on-tertiary: '#ffffff'
  tertiary-container: '#293a50'
  on-tertiary-container: '#92a4be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#adc8f5'
  on-primary-fixed: '#001c3b'
  on-primary-fixed-variant: '#2d486d'
  secondary-fixed: '#eee2bd'
  secondary-fixed-dim: '#d2c6a3'
  on-secondary-fixed: '#211b05'
  on-secondary-fixed-variant: '#4e462c'
  tertiary-fixed: '#d2e4ff'
  tertiary-fixed-dim: '#b6c8e3'
  on-tertiary-fixed: '#091c31'
  on-tertiary-fixed-variant: '#37485e'
  background: '#faf9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e3e2e6'
typography:
  display-lg:
    fontFamily: Noto Serif
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Noto Serif
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Noto Serif
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Noto Serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  figure-mono:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 48px
  container-max: 1200px
---

## Brand & Style
The design system is built upon a "ledger and ink" aesthetic, drawing inspiration from the tactile and authoritative nature of Indian financial heritage—specifically LIC bonds, vintage bank passbooks, and stamp paper. It evokes a sense of permanence, legal weight, and institutional trust.

The style is **Traditional-Modernist**. It rejects the ephemeral nature of "SaaS-blue" minimalism in favor of solid, official-looking surfaces. It utilizes high-contrast ink-on-paper aesthetics, avoiding gradients or artificial depth. The emotional response is one of serious-minded reliability, designed for users navigating the complexities of insurance and high-stakes financial documentation.

## Colors
The palette is grounded in the organic and chemical tones of Indian bureaucracy. 
- **Background**: A warm, aged paper tone (`#FAF6EC`) serves as the base, reducing digital glare and simulating parchment.
- **Surface**: The secondary "kraft" tone (`#E4D8B4`) is used for card containers, providing a distinct physical layer that suggests folders or heavy envelopes.
- **Ink**: The primary Ledger Indigo (`#1E3A5F`) acts as the standard "ink" for most text and interactive elements.
- **Status Tones**: These are derived from natural pigments: Sindoor Red for alerts, Turmeric Gold for warnings, and Neem Green for favorable outcomes.
- **Verification**: The Stamp Navy (`#16283D`) is reserved for high-level validation elements and official marks.

## Typography
The typography system uses a bilingual pairing of **Noto Serif** and **Noto Sans** to ensure perfect rendering of Devanagari script alongside Latin characters. 

- **Headlines**: Use Noto Serif to establish authority. For insurance scores and policy names, use the `display-lg` or `headline-lg` styles.
- **Body & UI**: Noto Sans is utilized for all functional text, maintaining high legibility at small sizes.
- **Financial Figures**: All Rupee amounts (₹) must use `figure-mono` settings. This ensures tabular alignment in lists and comparisons. 
- **Formatting**: Always apply Indian digit grouping (e.g., ₹1,00,000) for all currency displays to maintain local financial standards.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop and a fluid model on mobile. 
- **Grid**: A 12-column system for desktop with a rigid 16px gutter. 
- **Rhythm**: Spacing is strictly based on 4px increments. Use 24px (6 units) for standard padding between sections and 16px (4 units) for internal component padding.
- **Alignment**: Elements should feel "anchored" to the grid, echoing the printed columns of a ledger book. Right-align all currency columns in data tables to maintain the vertical visual flow of figures.

## Elevation & Depth
This design system avoids modern ambient shadows. Instead, it uses **Tonal Layers** and **Solid Offsets** to convey hierarchy.
- **Tiers**: The background is the bottom layer. The Kraft-colored (`#E4D8B4`) cards sit on top.
- **Borders**: Depth is communicated via 1px solid borders in Primary Indigo. For high-emphasis cards, a 2px offset "shadow" can be used—this is not a blur, but a solid block of the primary color shifted 2px right and 2px down.
- **Separators**: Use thin horizontal lines (0.5pt equivalent) for list items, mimicking the ruling of ledger paper.

## Shapes
Shapes are disciplined and architectural.
- **Standard Radius**: 8px (0.5rem) is the default for all cards, buttons, and input fields. This "soft-sharp" corner reflects the slightly worn edges of heavy paper documents.
- **The Verification Stamp**: A specialized component. It must be a serrated circular border containing "VERIFIED" or a date. It should be rendered in Stamp Navy (`#16283D`) and rotated randomly between 2 and 4 degrees (clockwise or counter-clockwise) to simulate a physical ink stamp application.

## Components
- **Buttons**: Primary buttons are solid Ledger Indigo with white text. Secondary buttons are outlined in 1px Indigo. Avoid all rounded-pill shapes; use the standard 8px radius.
- **Cards**: Use the Kraft background (`#E4D8B4`). Insets within cards should use the Paper background (`#FAF6EC`) to create a "nested document" feel.
- **Inputs**: Text fields must have a solid 1px border. Labels should be small-cap or uppercase `label-md` to mimic form-headers on official applications.
- **Trust Marks**: Instead of generic SVG icons, use localized IRDAI-regulated trust marks and official seal iconography. 
- **Lists**: Use "dot-leaders" (horizontal periods) between a label and its value (e.g., Premium Amount ........ ₹5,000) to replicate the look of a printed ledger.
- **Verification Stamp**: Apply this component over the top-right corner of documents or cards that have passed validation/KYC. It should have a slightly textured "ink-bleed" opacity (90-95%) if possible.