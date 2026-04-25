# Admin Panel Redesign Plan

## 1. Research and Discovery

- [x] Explore Adobe Spectrum design system: `spectrum.adobe.com`
- [x] Explore React Spectrum implementation: `react-spectrum.adobe.com`
- [x] Analyze core principles: "Adaptive Design", "Hierarchy", and "Platform Scale".
- [x] Identify key components for the redesign: Buttons, Tables, Dialogs, Nav.

## 2. Technical Stack Setup

- [ ] Install necessary `@adobe/react-spectrum` packages.
- [ ] Configure Spectrum's `Provider` for color schemes (Light/Dark) and scale (Medium).

## 3. Design Audit and Component Replacement

- [ ] Analyze the existing admin panel code in `src/pages/admin/index.tsx`, `src/pages/admin/users.tsx` and `src/pages/admin/issues.tsx`.
- [ ] Identify all custom CSS and generic components that can be replaced.
- [ ] Replace custom layout components with Spectrum’s layout primitives (`Flex`, `Grid`, `View`).
- [ ] Replace existing `Table` components with Spectrum's `TableView`.

## 4. Functionality Implementation

- [ ] Implement "Status Grips" for expiration dates using semantic colors.
- [ ] Red: expired
- [ ] Orange: "due soon"
- [ ] Green: "safe"
- [ ] Ensure the layout is fully responsive and accessible.

## 5. Refactoring and Output

- [ ] Refactor the main Dashboard (`src/pages/admin/index.tsx`).
- [ ] Refactor the Item List (`src/pages/admin/users.tsx` and `src/pages/admin/issues.tsx`).
- [ ] Provide the refactored code for the main Dashboard and Item List.

## Todo List

- [ ] **Research & Discovery**
  - [x] Explore Adobe Spectrum design system.
  - [x] Explore React Spectrum implementation.
  - [x] Analyze core principles.
  - [x] Identify key components.
- [ ] **Technical Stack Setup**
  - [ ] Install `@adobe/react-spectrum` packages.
  - [ ] Configure Spectrum's `Provider`.
- [ ] **Design Audit & Component Replacement**
  - [ ] Analyze existing admin panel code.
  - [ ] Replace custom CSS and components.
  - [ ] Replace layout components.
  - [ ] Replace tables.
- [ ] **Functionality**
  - [ ] Implement "Status Grips".
  - [ ] Ensure responsiveness and accessibility.
- [ ] **Refactoring & Output**
  - [ ] Refactor Dashboard.
  - [ ] Refactor Item Lists.
  - [ ] Provide refactored code.
