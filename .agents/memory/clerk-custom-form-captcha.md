---
name: Niestandardowe formularze Clerk
description: Wymagania ochrony antybotowej dla własnych formularzy rejestracji opartych o Clerk.
---

Niestandardowy formularz rejestracji Clerk musi renderować element o identyfikatorze `clerk-captcha` w formularzu przed przyciskiem wysłania.

**Why:** Bez tego Clerk nie może osadzić Smart CAPTCHA, przechodzi na zawodny tryb niewidoczny i może zatrzymać rejestrację przed wysłaniem kodu email.

**How to apply:** Przy każdej własnej implementacji signup zachować kontener CAPTCHA i testować przejście od utworzenia konta do ekranu kodu; sterowane przeglądarki mogą nadal zostać zablokowane przez Turnstile.