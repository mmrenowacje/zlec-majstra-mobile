---
name: Weryfikacja kont mobilnych
description: Granica odpowiedzialności między zarządzanym Clerk a przyszłą weryfikacją telefonu.
---

Zarządzany Clerk jest źródłem tożsamości i statusu weryfikacji email. Numer telefonu zapisujemy jako dane profilu, ale nie oznaczamy go jako zweryfikowany. Jeśli produkt ma potwierdzać telefon kodem, należy użyć osobnego dostawcy SMS (preferowany kierunek: Twilio Verify).

**Why:** Obecna konfiguracja Clerk zarządzana przez Replit nie obsługuje w tym projekcie logowania ani weryfikacji telefonem.

**How to apply:** Nie budować SMS na API Clerk i nie wyprowadzać statusu weryfikacji telefonu z samego faktu zapisania numeru. Integrację SMS traktować jako osobny przepływ i osobne zadanie.

Mobilne logowanie musi osobno obsługiwać statusy `needs_client_trust` i `needs_second_factor`: kod email przez metody MFA Clerk oraz kod TOTP z aplikacji uwierzytelniającej. Nie są to błędy konta.

**Why:** Clerk może wymagać potwierdzenia nowego urządzenia już po poprawnym haśle; ogólny komunikat o kontakcie z obsługą blokuje wtedy prawidłowego użytkownika.

**How to apply:** Po `signIn.password()` finalizować tylko status `complete`; dla dodatkowego czynnika pokazać formularz kodu i dopiero po jego weryfikacji wywołać `finalize()`.

Po `finalize()` status zalogowania może pojawić się chwilę przed pierwszym właściwym tokenem nowej sesji. Zapytania API muszą wymusić świeży token, a nie tylko czekać na dowolny niepusty wynik.

**Why:** Expo Go potrafi zwrócić z pamięci token poprzedniej sesji i cache’ować prywatną odpowiedź profilu; skutkiem są przejściowe `401` lub `304` tuż po MFA.

**How to apply:** Po zmianie sesji pobrać token z pominięciem cache, wyczyścić zapytanie profilu i dopiero wtedy włączyć chronione API. Odpowiedzi API konta muszą mieć `no-store` i bez ETag.

Pobieranie świeżego tokenu po MFA ma być pojedynczą operacją uruchamianą przez zmianę stanu zalogowania, nie pętlą zależną od referencji `getToken`.

**Why:** Referencja funkcji Clerk może zmieniać się podczas aktualizacji sesji; efekt zależny od niej anulował własne oczekiwanie i generował lawinę żądań tokenu, pozostawiając pusty ekran.

**How to apply:** Efekt synchronizacji sesji wiązać ze zmianą `isSignedIn`, obsłużyć brak tokenu i wyjątek oraz zawsze renderować stan ładowania lub błąd zamiast `null`.