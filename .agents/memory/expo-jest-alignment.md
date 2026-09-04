---
name: Zgodność Jest Expo
description: Wersje runnera Jest, preset'u jest-expo i typów TypeScriptu w aplikacji Expo.
---

`jest-expo` jest presetem i nie dostarcza samodzielnie pakietu runnera `jest`. W aplikacji Expo SDK 54 należy jawnie dodać Jest 29 oraz wyrównać `@types/jest` do głównej wersji 29.

**Why:** Uruchomienie samego preset'u zakończyło się błędem braku `jest/package.json`, a jego peer dependency akceptuje wersje 27–29.

**How to apply:** Przy konfiguracji testów Expo dodawaj razem `jest-expo`, `jest` i `@types/jest`, a konfigurację preset'u zapisuj w `package.json`.