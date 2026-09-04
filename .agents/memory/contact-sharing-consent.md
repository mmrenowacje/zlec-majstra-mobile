---
name: Zgoda na udostępnienie kontaktu
description: Reguła rozdzielająca płatny dostęp do rozmowy od decyzji klienta o ujawnieniu danych kontaktowych.
---

Aktywny, opłacony abonament fachowca daje dostęp do komunikatora, ale nigdy sam nie ujawnia telefonu, e-maila ani dokładnego adresu zlecenia. Te dane udostępnia wyłącznie właściciel zlecenia po rozpoczęciu rozmowy.

**Why:** Zleceniodawca ma zachować kontrolę nad prywatnymi danymi, a płatność fachowca kupuje możliwość rozmowy, nie automatyczny dostęp do danych osobowych.

**How to apply:** Wszystkie odpowiedzi API, listy, widoki i nowe kanały komunikacji muszą maskować telefon, e-mail i dokładny adres do czasu zapisanej zgody klienta. Fachowiec musi mieć aktywny abonament, aby wejść do rozmowy i odczytać udostępnione dane.