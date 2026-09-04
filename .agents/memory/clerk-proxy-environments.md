---
name: Proxy Clerk zależne od środowiska
description: Zasada konfiguracji proxy Clerk w klientach web i Expo między development a produkcją.
---

W trybie developerskim klienci web i Expo mają łączyć się z Clerk bez `proxyUrl`. Produkcyjny `proxyUrl` należy przekazywać wyłącznie w buildzie produkcyjnym.

**Why:** Backend świadomie nie uruchamia middleware proxy Clerk w development. Użycie jego ścieżki przez lokalnego klienta powoduje 404 przy ładowaniu Clerk JS, brak tokenu sesji i 401 na chronionych endpointach, między innymi przygotowaniu uploadu do App Storage.

**How to apply:** Każdą zmianę konfiguracji Clerk sprawdzaj osobno w development i produkcji. Web powinien uzależniać `proxyUrl` od trybu buildu, a Expo od `__DEV__`; token Bearer nadal przekazuj do wspólnego klienta API.