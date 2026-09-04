---
name: Migracja starszej bazy Replit
description: Bezpieczne przenoszenie danych z legacy Neon do aktualnej bazy Development zarządzanej przez Replit.
---

Po usunięciu starszego sekretu `DATABASE_URL` aktualna baza Development może mieć już utworzony schemat i część rekordów. Nie przywracaj wtedy całej kopii wprost ani z opcją czyszczenia; porównaj dane i scal brakujące rekordy transakcyjnie.

**Why:** Kopia legacy zawiera również techniczny schemat `_system`, którego nowa baza nie udostępnia, a częściowo przeniesione rekordy powodują konflikty kluczy. Ślepy restore może przerwać się lub nadpisać nowszy stan.

**How to apply:** Najpierw wykonaj zweryfikowany `pg_dump` poza repozytorium. Po przełączeniu bazy wyklucz `_system`, załaduj dane do tymczasowego schematu, porównaj konflikty i scal je zgodnie z czasem aktualizacji. Produkcję aktualizuj wyłącznie przez Publish.