# Design System Manifest: AvanPlastic (CPI)

## 1. Identity and Visual Concept (Vibe)
The design system must reflect a modern, highly aesthetic, and sober interface for a plastics injection factory. It prioritizes minimalist elegance, operational efficiency, and technical clarity. The UI is an administrative and production floor dashboard. It must support high data density without visual clutter, using a refined and subdued color palette.

## 2. Color Palette (Design Tokens)
- **Primary (Midnight Slate):** `#0F172A` (Used for navigation bars, primary action buttons, and top-level hierarchy. Provides a sober, grounded anchor).
- **Secondary (Muted Steel):** `#64748B` (Used for secondary actions, inactive states, and subtle highlights).
- **Accent (Subdued Blue):** `#3B82F6` (Used sparingly for active states, focus rings, and critical interactive elements).
- **Background (Soft Zinc):** `#FAFAFA` (General application background to maximize contrast while maintaining a soft aesthetic).
- **Surface (Pure White):** `#FFFFFF` (Background for cards, modals, and data tables).
- **Text Primary:** `#18181B` (Headings and critical data).
- **Text Secondary:** `#52525B` (Labels, descriptions, and secondary data).
- **Borders:** `#E4E4E7` (Subtle dividers to separate information zones without adding visual noise).

## 3. Typography
- **Primary Family:** `Inter`, sans-serif. Chosen for its modern aesthetic and exceptional readability in dense data environments.
- **Weights:**
  - Regular (400) for general reading and table data.
  - Medium (500) for table headers, secondary buttons, and UI labels.
  - SemiBold (600) for section headers and key data points (KPIs).

## 4. Geometry and Spacing (UI Components)
- **Border Radius:**
  - Small elements (inputs, buttons): `6px` (`rounded-md` in Tailwind).
  - Container elements (cards, modals): `12px` (`rounded-xl` in Tailwind) for a softer, more modern aesthetic.
- **Shadows:** Use ultra-soft, diffused shadows (`shadow-sm` and `shadow-md` with low opacity) to lift `Surface` elements from the `Background`, creating elegant depth.
- **Paddings:** Adhere to a strict 4px baseline grid (e.g., p-4, p-6) to maintain balanced and breathable proportions.

## 5. Interaction Patterns
- Primary buttons should feature a subtle hover state that slightly darkens the background (e.g., `hover:bg-slate-800`) with a smooth transition (`transition-colors duration-200`).
- Forms and inputs must have clean, un-intrusive borders that switch to the `Accent` color upon receiving focus, providing elegant digital feedback.
- Payroll and incidence tables must prioritize clean alignment, with numerical data strictly right-aligned and generous row padding for readability.