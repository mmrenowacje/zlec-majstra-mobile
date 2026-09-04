---
name: Testowanie Clerk w Express
description: Wymagania adaptera uwierzytelnienia dla integracyjnych testów routerów Express korzystających z getAuth.
---

W testach integracyjnych routera Express funkcja `req.auth` musi być oznaczona symbolem `Symbol.for("@clerk/express.auth")`; sama funkcja zwracająca dane użytkownika nie jest uznawana przez `getAuth`.

**Why:** Clerk celowo sprawdza ten znacznik, aby nie pomylić własnego obiektu uwierzytelnienia z właściwościami dodawanymi przez inne biblioteki.

**How to apply:** Gdy test montuje router bez produkcyjnego middleware Clerk, przygotuj oznaczoną funkcję `req.auth` i uwzględnij zarówno zalogowanego użytkownika, jak i stan bez sesji.