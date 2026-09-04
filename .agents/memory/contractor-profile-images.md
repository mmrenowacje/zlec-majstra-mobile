---
name: Zdjęcia profilu fachowca
description: Decyzja o źródle i sposobie udostępniania zdjęć oraz logo profilu.
---

Zdjęcie profilowe lub logo fachowca należy zapisywać jako obraz konta Clerk, a nie jako plik lub dane binarne w bazie aplikacji. API profilu udostępnia wyłącznie aktualny URL obrazu pobrany z Clerk.

**Why:** Obraz jest częścią tożsamości użytkownika na webie i mobile; Clerk zapewnia trwały upload, zmianę obrazu i wspólne źródło dla obu klientów bez duplikowania pliku.

**How to apply:** Klienci przesyłają obraz metodą profilu użytkownika Clerk, następnie odświeżają użytkownika i zapytanie profilu. W Expo przekazuj obraz jako Base64 data URL — `Blob` utworzony z lokalnego URI jest zawodny w React Native. Baza aplikacji przechowuje tylko dane firmy i nie jest źródłem obrazu.