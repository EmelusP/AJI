# AJI Zad3 – Backend (Express + SQL Server)

Serwer Express.js obsługujący sklep z produktami i zamówieniami. Baza: Microsoft SQL Server. Zawiera walidację, kody błędów (http-status-codes), predefiniowane kategorie i stany zamówienia oraz opcjonalny endpoint SEO z generacją opisu.

## Wymagania
- Node.js 18+
- SQL Server (lokalnie/dockery lub zdalnie)

## Konfiguracja
1. Skopiuj środowisko:
   ```bash
   cp .env.example .env
   # Uzupełnij parametry DB_* dla SQL Server
   ```
2. Utwórz schemat i dane startowe w bazie (uruchom w SSMS/Azure Data Studio):
   - plik: `scripts/schema.sql` (tworzy DB `aji_shop`, tabele, stany i przykładowe kategorie oraz produkty)

3. Zainstaluj zależności:
   ```bash
   npm ci
   ```

4. Uruchom serwer:
   ```bash
   npm run dev
   # lub
   npm start
   ```

Serwer nasłuchuje na porcie `PORT` (domyślnie 3000). Health check: `GET /health`.

## Endpoints

### Kategorie
- `GET /categories` – lista kategorii

### Statusy zamówień
- `GET /status` – lista statusów (`1: PENDING`, `2: CONFIRMED`, `3: CANCELED`, `4: FULFILLED`)

### Produkty
- `GET /products` – lista produktów
- `GET /products/:id` – produkt po ID
- `POST /products` – dodanie produktu
  - body: `{ name, description, unit_price, unit_weight, category_id }`
- `PUT /products/:id` – aktualizacja produktu (dowolne pole poza ID)

Walidacja: nazwa/opis niepuste, cena/waga > 0, poprawna kategoria.

### Zamówienia
- `GET /orders` – lista zamówień (nagłówki)
- `GET /orders/:id` – zamówienie z pozycjami
- `GET /orders/user/:username` – zamówienia dla użytkownika
- `GET /orders/status/:statusId` – zamówienia wg statusu
- `POST /orders` – utworzenie zamówienia
  - body: `{ user_name, email, phone, approved_at? (null|iso), items: [{ product_id, quantity, vat?, discount? }] }`
  - walidacja: pola użytkownika niepuste/poprawne, produkty muszą istnieć, ilości > 0; cena pozycji kopiowana z aktualnej ceny produktu
  - status początkowy: `PENDING` (1) lub `CONFIRMED` (2) jeśli podano `approved_at`
- `PATCH /orders/:id` – zmiana statusu
  - body: `{ status_id }`
  - reguły: 
    - `PENDING (1) -> CONFIRMED (2) | CANCELED (3)`
    - `CONFIRMED (2) -> FULFILLED (4) | CANCELED (3)`
    - `CANCELED (3)` i `FULFILLED (4)` – zmiana niedozwolona

### SEO (D1 – opcjonalne)
- `GET /products/:id/seo-description` – zwraca HTML z opisem SEO
  - Jeśli ustawione `LLM_BASE_URL` i `LLM_API_KEY`, serwer wywołuje endpoint zgodny z OpenAI Chat Completions (`/chat/completions`, np. Groq). W przeciwnym razie zwraca szablonową wersję HTML.

## Błędy i kody statusów
- Spójna obsługa JSON z użyciem `http-status-codes` (`src/common/http.js`).
- Przykłady: 400 (walidacja), 404 (brak zasobu), 409 (niepoprawna zmiana statusu), 500 (błędy serwera/DB).

## Struktura projektu
- `src/` – kod serwera Express
  - `api/` – routery: products, orders, categories, statuses, seo
  - `common/` – db, http helpers, walidacje, reguły statusów
  - `services/seo.js` – integracja LLM + fallback
- `scripts/` – SQL do utworzenia bazy i seedów
- `.env.example` – zmienne środowiskowe

## Testowanie w Postman/HTTPie
Przykładowe zapytania:
1. `GET http://localhost:3000/categories`
2. `POST http://localhost:3000/products` z JSON body
3. `POST http://localhost:3000/orders` z JSON body z pozycjami
4. `PATCH http://localhost:3000/orders/1` body `{"status_id":2}`
5. `GET http://localhost:3000/products/1/seo-description`

## Uwaga dot. bezpieczeństwa
- Nie logujemy PII. Hasła/sekrety tylko w `.env` (nie commitować!).

