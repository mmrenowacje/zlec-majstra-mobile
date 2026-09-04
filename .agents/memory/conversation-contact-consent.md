---
name: Zgoda kontaktowa w rozmowach
description: Zasada izolowania wiadomości i zgody na kontakt pomiędzy fachowcami odpowiadającymi na to samo zlecenie.
---

Każda rozmowa jest odrębnym wątkiem pary zlecenie–fachowiec. Operacje klienta, zwłaszcza wysłanie wiadomości i udostępnienie telefonu lub e-maila, muszą wskazywać identyfikator wybranego wątku; sam identyfikator zlecenia nie wystarcza.

**Why:** Dla jednego zlecenia może pisać wielu fachowców. Wybór najnowszej rozmowy po czasie aktualizacji tworzy wyścig, w którym zgoda może trafić do innej osoby niż ta widoczna klientowi.

**How to apply:** Każdy klient webowy lub mobilny powinien pokazać selektor wątków, a API musi autoryzować wskazaną rozmowę względem zlecenia i uczestnika przed odczytem, zapisem lub ujawnieniem danych.