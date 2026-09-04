---
name: Blokada edycji zlecenia po zgodzie
description: Reguła rozdzielająca edycję treści zlecenia od późniejszego zarządzania statusem realizacji.
---

Właściciel może edytować tytuł, opis, lokalizację, dokładny adres, budżet i zdjęcia tylko do chwili udostępnienia danych pierwszemu fachowcowi. Po zgodzie te pola są niezmienne, ale status nadal można aktualizować.

**Why:** Fachowiec podejmuje decyzję na podstawie konkretnej treści, a po otrzymaniu kontaktu i adresu nie powinien zobaczyć jednostronnie zmienionych warunków. Jednocześnie strony muszą móc oznaczyć rozpoczęcie i zakończenie pracy.

**How to apply:** Egzekwuj blokadę na serwerze na podstawie zapisanej zgody w dowolnej rozmowie danego zlecenia; ukrycie formularza w kliencie jest tylko dodatkową warstwą. Nie blokuj aktualizacji samego statusu.