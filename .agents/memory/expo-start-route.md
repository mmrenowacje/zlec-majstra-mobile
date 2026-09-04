---
name: Start nawigacji Expo
description: Reguła bezpiecznego wyboru pierwszej trasy w aplikacji z Clerk i chronionymi grupami Expo Router.
---

Mobilna aplikacja musi mieć jawną trasę `/`, która po załadowaniu Clerk kieruje wylogowanych do logowania, konta bez profilu do onboardingu, a gotowe konta do chronionej grupy kart.

**Why:** Bez jawnej trasy startowej albo przy bezwarunkowym przekierowaniu do chronionej grupy Expo Router może odrzucić akcję `REPLACE` i pozostawić pusty ekran.

**How to apply:** Po zmianach w auth lub układzie tras zawsze otwórz `/` w świeżej sesji wylogowanej i sprawdź, czy pojawia się formularz logowania bez ostrzeżenia o nieobsłużonej trasie.