---
name: Weryfikacja nowych urządzeń Clerk
description: Różnica między potwierdzeniem emaila przy rejestracji a kodem Device Trust przy logowaniu.
---

Kod email po poprawnym haśle przy logowaniu pochodzi z funkcji Clerk Device Trust, a nie z rejestracyjnej weryfikacji adresu. Wyłączenie tej funkcji jest ustawieniem panelu Clerk; usunięcie obsługi statusu z aplikacji tylko zablokuje logowanie.

**Why:** Device Trust jest automatycznie włączany w nowszych aplikacjach Clerk i może wyglądać jak niechciana ponowna weryfikacja emaila.

**How to apply:** Jeśli produkt wymaga kodu wyłącznie przy rejestracji, wyłącz Device Trust osobno w środowisku Development i Production. Obsługę `needs_client_trust` pozostaw, gdy funkcja ma być aktywna.