---
name: Dostęp po płatności PayU
description: Zasady aktywacji i przedłużania miesięcznego dostępu fachowca po płatności.
---

Tylko poprawnie podpisane serwerowe powiadomienie PayU o statusie COMPLETED może aktywować abonament. Powrót przeglądarki lub deep link służy wyłącznie do pokazania statusu.

**Why:** Przekierowanie klienta można sfałszować, a powiadomienia bywają ponawiane. Jednorazowa opłata kupuje 30 dni; jeśli dostęp jeszcze trwa, kolejna płatność dodaje 30 dni od obecnej daty końca zamiast od dnia zapłaty.

**How to apply:** Każdy nowy kanał płatności musi zachować serwerową aktywację, idempotencję oraz walidację właściciela, kwoty, waluty i identyfikatora zamówienia.