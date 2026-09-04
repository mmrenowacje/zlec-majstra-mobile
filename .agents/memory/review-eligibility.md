---
name: Uprawnienia do opinii
description: Reguła wiążąca opinię z zakończonym zleceniem i potwierdzoną relacją klient–fachowiec.
---

Opinię może wystawić wyłącznie właściciel zakończonego zlecenia i tylko fachowcowi, któremu zleceniodawca po rozmowie udostępnił kontakt. Jedna para zlecenie–fachowiec ma najwyżej jedną opinię, a fachowiec najwyżej jedną odpowiedź.

**Why:** Obecny model nie ma ofert ani formalnego przypisania wykonawcy. Zgoda zleceniodawcy na udostępnienie kontaktu jest serwerowym dowodem relacji obu stron i nie powinna wymagać nadal aktywnego abonamentu przy późniejszej opinii.

**How to apply:** Każdy nowy kanał tworzenia lub importu opinii musi egzekwować te same reguły po stronie serwera i nie może ujawniać danych kontaktowych w odpowiedzi.