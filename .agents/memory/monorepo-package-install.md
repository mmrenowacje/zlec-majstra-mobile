---
name: Zależności w monorepo
description: Ograniczenie instalatora pakietów przy dodawaniu zależności do pojedynczego workspace'u.
---

W monorepo instalacja zależności przez ogólny instalator może próbować zmienić główny workspace zamiast wskazanego artefaktu. Dla zależności konkretnego artefaktu należy używać instalacji filtrowanej przez nazwę workspace'u i sprawdzić lockfile oraz typecheck.

**Why:** Próba dodania typów Jest bez wskazania workspace'u zakończyła się błędem `ERR_PNPM_ADDING_TO_ROOT`, mimo że zależność była poprawna.

**How to apply:** Przy zmianach zależności w jednym artefakcie zawsze kieruj instalację do jego workspace'u, zamiast instalować pakiet globalnie lub do root package.