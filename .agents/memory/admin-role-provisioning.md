---
name: Nadawanie roli administratora
description: Zasada bezpiecznego przydzielania i zachowywania roli administratora.
---

Rola administratora jest nadawana wyłącznie poza publicznym formularzem profilu. Dane wejściowe użytkownika mogą wybierać tylko rolę zleceniodawcy albo fachowca, a aktualizacja profilu nie może obniżyć ani nadpisać istniejącej roli administratora.

**Why:** Umieszczenie roli administratora w rejestracji lub bezpośrednie przyjmowanie jej z klienta tworzyłoby prostą ścieżkę do przejęcia panelu płatności.

**How to apply:** Każdy nowy formularz rejestracji, endpoint profilu i mechanizm synchronizacji tożsamości musi zachować ten podział oraz autoryzować operacje administratora na podstawie roli zapisanej po stronie serwera.