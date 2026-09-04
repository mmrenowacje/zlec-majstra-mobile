---
name: Brama wydania dla płatności sandbox
description: Zasady wiarygodnego testu zewnętrznego checkoutu przed wydaniem.
---

Test bramkujący wydanie dla zewnętrznego operatora płatności musi przejść przez jego prawdziwy sandbox, odebrać autentycznie podpisany callback w izolowanym środowisku oraz uruchomić docelowy handler powrotu. Samo utworzenie zamówienia, lokalnie spreparowany webhook lub porównanie tekstu URL nie wystarcza.

**Why:** Takie skróty nie wykrywają zmian formularza operatora, niedostępnego webhooka, błędnego routingu web ani sytuacji, w której system operacyjny rozpoznaje schemat mobilny, ale aplikacja nie uruchamia kodu obsługi.

**How to apply:** Używaj osobnych danych sandbox, ogranicz host operatora, wystawiaj jednorazowy publiczny tunel do izolowanej bazy, odtwarzaj autentyczny callback dla idempotencji i sprawdzaj mobilny deep link na zainstalowanym buildzie z osadzonym kodem aplikacji.