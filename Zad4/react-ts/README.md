# AJI – Zadanie 4 (React + TypeScript)

Prosta, responsywna aplikacja frontendowa do obsługi zamówień sklepu z zadania 3. UI korzysta z API Express/MSSQL (autentykacja JWT), a wszystkie wymagane funkcje na ocenę 3 zostały zaimplementowane w React + TypeScript + Bootstrap.

## Wymagania
- Node.js 18+
- Backend z zadania 3 uruchomiony lokalnie (domyślnie `http://localhost:3000`). Upewnij się, że zmienna `CLIENT_ORIGIN` w backendzie zawiera `http://localhost:5173`.

## Uruchomienie
```bash
cd /Users/bartoszdziuba/WebstormProjects/AJI/Zad4/react-ts
npm install                      # jednorazowo
# (opcjonalnie) echo "VITE_API_URL=http://localhost:3000" > .env
npm run dev                      # tryb developerski (http://localhost:5173)
# produkcja: npm run build && npm run preview
```

## Funkcjonalności
- **Katalog towarów** – tabela (nazwa, opis, cena) z filtrowaniem po nazwie i kategorii; przyciski „Kup” i „Edytuj” (drugi dostępny po zalogowaniu) korzystają z Bootstrapowych komponentów.
- **Koszyk i zamówienie** – osobny widok z tabelą zamówionych towarów (zmiana ilości ±, pole liczby, usuwanie), formularzem danych kontaktowych (nazwa, email, telefon) oraz informacją o łącznej kwocie. Dane walidowane po stronie klienta przed wysłaniem, błędy wyświetlane w formularzu.
- **Składanie zamówienia** – żądanie `POST /orders`; po sukcesie koszyk jest czyszczony.
- **Zmiana właściwości towaru** – formularz edycji (kategoria, cena, waga) wysyła `PUT /products/:id`; błędy walidacji są prezentowane dokładnie tak, jak zwróci je serwer.
- **Panel pracownika** – lista niezrealizowanych zamówień (data zatwierdzenia, wartość, lista pozycji) z przyciskami zmiany statusu na ZREALIZOWANE (4) lub ANULOWANE (3).
- **Zamówienia wg statusu** – tabela (data zatwierdzenia, wartość) po wybraniu statusu z listy.
- **Rejestracja i logowanie** – osobny widok „Logowanie” z formularzem logowania (JWT) i rejestracji klienta. Próba wejścia do części chronionej lub zapisu produktu bez tokenu przekierowuje użytkownika do logowania (fallback).

## Struktura
```
src/
├── App.tsx          # cała logika UI, widoki i formularze
├── main.tsx         # bootstrap + React root
├── index.css        # podstawowe style
└── services/
    └── api.ts       # klient HTTP + typy TS
```

## Uwagi
- Aplikacja zakłada działające endpointy z zadania 3 (`/products`, `/categories`, `/status`, `/orders`, `/login`, `/register`, ...).
- Tokeny JWT są przechowywane w `localStorage`. Wylogowanie usuwa tokeny i czyści stany panelu pracownika.
