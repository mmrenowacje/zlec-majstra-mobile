---
name: Android production build
description: Różnica między lokalnym bundlem Expo a natywnym artefaktem Androida w Replit.
---

Oficjalny przepływ Replit może wygenerować natywny Android App Bundle `.aab`, który następnie pobiera się i ręcznie przesyła do Google Play Console. Lokalny skrypt `build` tego artefaktu nie tworzy — generuje produkcyjne bundle JavaScript i manifesty Expo używane przez mobilny preview.

**Why:** Weryfikacja lokalnego bundle'a potwierdza poprawność kodu, ale nie jest dowodem wygenerowania instalowalnego pliku Google Play.

**How to apply:** Przed komunikatem o gotowym pliku Androida rozróżniaj wynik lokalnego `build` od natywnego `.aab`; nie uruchamiaj poleceń EAS CLI w środowisku Replit.