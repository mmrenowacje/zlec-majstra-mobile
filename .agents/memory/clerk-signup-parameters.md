---
name: Parametry rejestracji Clerk
description: Zgodność formularzy rejestracji z aktualnym API Clerk Core
---

`signUp.password()` powinno otrzymywać wyłącznie `emailAddress` i `password`. Imię, nazwisko, telefon oraz dane firmowe należą do profilu aplikacji i powinny być zapisywane osobno po zakończeniu weryfikacji.

**Why:** Aktualne API Clerk odrzuca dodatkowe pola profilu błędem typu `first_name is not a valid parameter for this request`.

**How to apply:** Przy zmianach rejestracji sprawdź payload `signUp.password()` w webie i mobile; nie dodawaj do niego pól profilu.