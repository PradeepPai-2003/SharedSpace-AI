# SharedSpace AI - Design System Specification

Welcome to the design system specification for **SharedSpace AI**. This document serves as the single source of truth for all UI/UX choices, color schemes, typographies, spacing, animation tokens, and theme controls.

---

## 1. Color Palette

Our layout features a high-contrast, modern, glassmorphic layout inspired by Linear, ChatGPT, Discord, and Vercel.

### Dark Theme (Default)
* **Background Primary**: `#0B1020` (Deep midnight void)
* **Background Secondary / Surface**: `#16213E` (Sleek dark blue surface)
* **Background Elevated**: `#1F305E` (Focus / elevated dialog borders)
* **Accent Primary**: `#6366F1` (Vibrant Indigo for primary buttons/branding)
* **Accent AI**: `#14B8A6` (Teal for AI indicators, messages, and glows)
* **Text Primary**: `#FFFFFF` (Crisp white)
* **Text Secondary**: `#94A3B8` (Slate blue-gray)
* **Border Primary**: `#2A3B5C` (Subtle boundary borders)

### Light Theme
* **Background Primary**: `#F8FAFC` (Slate grey canvas)
* **Background Secondary / Surface**: `#FFFFFF` (Pure white card surfaces)
* **Background Elevated**: `#E2E8F0` (Hover selection items/secondary controls)
* **Accent Primary**: `#6366F1` (Indigo accent)
* **Accent AI**: `#14B8A6` (Teal AI accent)
* **Text Primary**: `#0F172A` (Slate 900 for high readability)
* **Text Secondary**: `#475569` (Slate 600 secondary text)
* **Border Primary**: `#E2E8F0` (Light grey borders)

---

## 2. Typography

* **Sans-Serif Font**: `'Inter', sans-serif` (Imported from Google Fonts)
  * Default font for body, headers, buttons, and inputs.
* **Mono-Spaced Font**: `'JetBrains Mono', monospace` (For code snippets, prompt details, and markdown tags)
* **Font Weights**:
  * Light (`300`)
  * Normal (`400`)
  * Medium (`500`)
  * Semibold (`600`)
  * Bold (`700`)
  * Extrabold (`800`)

---

## 3. Spacing System

We adhere to a standard 8pt grid system to maintain sizing alignment:
* **xs**: `4px` (`0.25rem`)
* **sm**: `8px` (`0.5rem`)
* **md**: `12px` (`0.75rem`)
* **lg**: `16px` (`1rem`)
* **xl**: `24px` (`1.5rem`)
* **2xl**: `32px` (`2rem`)
* **3xl**: `48px` (`3rem`)

---

## 4. Animation System

All animations should feel fluid, intentional, and performant. Heavy 3D scenes or high-frequency parallax are forbidden to maximize rendering speed.

* **Transitions**: Use Framer Motion where dynamic UI enters/leaves, and vanilla CSS transitions for hover state overrides.
* **Duration**:
  * Fast micro-interactions (buttons, badges): `150ms - 200ms`
  * Modal transitions, panel slides: `300ms - 400ms`
* **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (easeOutExpo) for snappy entry.

---

## 5. Component Library

### Cards
* **Normal**: Surface background, border border-primary, shadow-lg.
* **Hover State**:
  * Scale to `1.02` (scale-[1.02])
  * Shadow glow increase (using accent-primary/10 or accent-ai/10 depending on card type)
  * Border color shifts to corresponding accent at `60%` opacity.
  * Smooth transitions over `300ms` duration.
  * Cursor pointer.

### Modals
* **Backdrop**: Fully saturated dark overlays (`bg-black/75` with `backdrop-blur-sm`).
* **Modal Body**: Scale and opacity transition (`opacity-0 scale-95` to `opacity-100 scale-100`) using cubic-bezier.

---

## 6. Theme System

The user's theme selection is stored in their browser's `localStorage` (preference key: `sharedspace-theme`).
* **Active Selector**: `.light` or `.dark` class added to `document.documentElement` (`<html>` tag).
* **Toggle Controls**: Rendered using a standard `Sun` or `Moon` icon in sidebars, headers, and quick-setting toggles.

---

## 7. Mobile Guidelines

Responsive design must be verified against these key viewport breakpoints:
* **320px** (iPhone SE and small screens) - Compact headers, drawer menus.
* **375px / 390px** (iPhone 12/13/14) - Stacked grids, hidden panels.
* **768px** (iPad Portrait) - Double column layouts where available.
* **1024px** (Desktop entry point) - Standard triple-column views.
* **1440px** (Wide layouts) - Maximized side panel views.

---

## 8. Dashboard Guidelines

* Clear headers presenting spaces count and quick action shortcuts.
* Grid system: Cards for "Create Space", "Join Workspace", and "AI Assistant Chat" must align horizontally on desktop (`grid-cols-3`) and stack vertically on mobile.
* Uniform padding, icons, and hover scales.

---

## 9. AI Assistant Guidelines

* **AI Presence**: Identified using `Sparkles` or `Bot` icons.
* **Breathing Glow**: Active status indicator uses a soft pulsing scale/glow animation (`animate-pulse-slow`).
* **AI Messages**: Rendered inside light-blue/teal backgrounds (`bg-accent-ai/5` or `bg-accent-ai/10`) to separate them from human user messages.

---

## 10. Workspace Guidelines

* Space side panels slide in from the right on mobile layouts.
* Active status indicators show green (online), amber (away), and gray (offline).
* Chat inputs and file upload dropzones resize fluidly based on viewport.
