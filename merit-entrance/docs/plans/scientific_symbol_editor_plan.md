# Scientific Symbol Editor Implementation Plan

## Overview
Create a comprehensive rich text editor with support for mathematical, chemical, physical, and biological symbols. This will include a demo page and database storage for testing and demonstration.

---

## Proposed Changes

### Component 1: Database Schema

#### [NEW] `prisma/migrations/xxx_add_demo_content/migration.sql`
Add a new `demo_content` table to store editor content:
```sql
CREATE TABLE demo_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### [MODIFY] [schema.prisma](file:///Users/charanpreetsingh/LabRecManagemer/merit-entrance/prisma/schema.prisma)
Add the DemoContent model to Prisma schema.

---

### Component 2: Scientific Symbol Editor Component

#### [NEW] [ScientificEditor.tsx](file:///Users/charanpreetsingh/LabRecManagemer/merit-entrance/src/components/ScientificEditor.tsx)
A reusable React component featuring:

**Symbol Categories:**
| Category | Symbols |
|----------|---------|
| **Math - Basic** | +, −, ×, ÷, =, ≠, ≈, ±, ∞ |
| **Math - Greek** | α, β, γ, δ, ε, θ, λ, μ, π, σ, φ, ω, Δ, Σ, Ω |
| **Math - Operators** | √, ∛, ∫, ∑, ∏, ∂, ∇, ∈, ∉, ⊂, ⊃, ∪, ∩ |
| **Math - Relations** | <, >, ≤, ≥, ≪, ≫, ∝, ⊥, ∥ |
| **Math - Superscripts** | ⁰, ¹, ², ³, ⁴, ⁵, ⁶, ⁷, ⁸, ⁹, ⁿ, ⁺, ⁻ |
| **Math - Subscripts** | ₀, ₁, ₂, ₃, ₄, ₅, ₆, ₇, ₈, ₉, ₊, ₋ |
| **Chemistry** | →, ⇌, ↑, ↓, ⟶, °, ‡, •, ΔH, ΔG, ΔS |
| **Physics** | ℏ, ε₀, μ₀, Å, eV, ℃, °F, Ω, μ, ·, × |
| **Biology** | ♀, ♂, †, ‡, °C, pH, DNA/RNA bases |
| **Arrows** | →, ←, ↔, ⇒, ⇐, ⇔, ↑, ↓ |

**Features:**
- Click-to-insert symbols into editor
- Category tabs for organized access
- Search/filter symbols
- Recently used symbols (localStorage)
- Keyboard shortcut support
- Format toolbar (bold, italic, underline, subscript, superscript)

---

### Component 3: Demo Page

#### [NEW] [page.tsx](file:///Users/charanpreetsingh/LabRecManagemer/merit-entrance/src/app/admin/demo-editor/page.tsx)
Demo page with:
- Scientific Editor component
- Save to database functionality
- Load saved content list
- Example templates (equations, reactions, formulas)
- Preview rendered content

---

### Component 4: API Endpoints

#### [NEW] [route.ts](file:///Users/charanpreetsingh/LabRecManagemer/merit-entrance/src/app/api/admin/demo-content/route.ts)
- `GET` - List all saved demo content
- `POST` - Save new content

#### [NEW] [route.ts](file:///Users/charanpreetsingh/LabRecManagemer/merit-entrance/src/app/api/admin/demo-content/[id]/route.ts)
- `GET` - Get single content by ID
- `PUT` - Update content
- `DELETE` - Delete content

---

## Example Templates

### Math Examples
```
Quadratic Formula: x = (-b ± √(b² - 4ac)) / 2a
Pythagorean: a² + b² = c²
Einstein: E = mc²
Integral: ∫₀^∞ e^(-x²) dx = √π/2
```

### Chemistry Examples
```
Water: H₂O
Photosynthesis: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂
Equilibrium: N₂ + 3H₂ ⇌ 2NH₃
Enthalpy: ΔH = -92 kJ/mol
```

### Physics Examples
```
Newton's Law: F = ma
Coulomb's Law: F = kq₁q₂/r²
Wave: λ = v/f
Planck: E = hν
```

---

## Verification Plan

### Automated Tests
1. Run `npm run build` to verify compilation
2. Start dev server and test demo page functionality

### Manual Verification
1. Navigate to `/admin/demo-editor`
2. Test inserting symbols from each category
3. Test save/load functionality
4. Test formatting (subscript/superscript)
5. Verify content renders correctly in preview

---

*Estimated implementation time: 30-45 minutes*
