-- Schemat SQL Server dla sklepu (produkty, kategorie, zamówienia, pozycje, statusy)
SET NOCOUNT ON;

-- Tworzenie bazy, jeśli nie istnieje
IF DB_ID('aji_shop') IS NULL
BEGIN
  CREATE DATABASE aji_shop;
END
GO

USE aji_shop;
GO

-- Czyszczenie tabel (na potrzeby dev). W produkcji – zakomentować.
IF OBJECT_ID('dbo.order_items', 'U') IS NOT NULL DROP TABLE dbo.order_items;
IF OBJECT_ID('dbo.orders', 'U') IS NOT NULL DROP TABLE dbo.orders;
IF OBJECT_ID('dbo.products', 'U') IS NOT NULL DROP TABLE dbo.products;
IF OBJECT_ID('dbo.categories', 'U') IS NOT NULL DROP TABLE dbo.categories;
IF OBJECT_ID('dbo.order_statuses', 'U') IS NOT NULL DROP TABLE dbo.order_statuses;
GO

-- Słownik statusów zamówienia
CREATE TABLE dbo.order_statuses (
  id INT NOT NULL PRIMARY KEY,
  name NVARCHAR(50) NOT NULL UNIQUE
);

-- Kategorie produktów (płaskie, predefiniowane)
CREATE TABLE dbo.categories (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL UNIQUE
);

-- Produkty sklepu
CREATE TABLE dbo.products (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX) NOT NULL,
  unit_price DECIMAL(18,2) NOT NULL,
  unit_weight DECIMAL(18,3) NOT NULL,
  category_id INT NOT NULL,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES dbo.categories(id)
);

-- Zamówienia (nagłówek)
CREATE TABLE dbo.orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  approved_at DATETIME NULL,
  status_id INT NOT NULL,
  user_name NVARCHAR(255) NOT NULL,
  email NVARCHAR(255) NOT NULL,
  phone NVARCHAR(50) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_orders_status FOREIGN KEY (status_id) REFERENCES dbo.order_statuses(id)
);

-- Pozycje zamówień (szczegóły)
CREATE TABLE dbo.order_items (
  id INT IDENTITY(1,1) PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(18,2) NOT NULL,
  vat DECIMAL(5,2) NULL,
  discount DECIMAL(5,2) NULL,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES dbo.orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES dbo.products(id)
);

-- Użytkownicy (do uwierzytelniania JWT)
CREATE TABLE dbo.users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(50) NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  role NVARCHAR(20) NOT NULL CHECK (role IN ('KLIENT', 'PRACOWNIK'))
);

-- Opinie do zamówień (D4)
CREATE TABLE dbo.order_opinions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  order_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content NVARCHAR(MAX),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_opinions_order FOREIGN KEY (order_id) REFERENCES dbo.orders(id) ON DELETE CASCADE
);

-- Wstawienie statusów (NIEZATWIERDZONE, ZATWIERDZONE, ANULOWANE, ZREALIZOWANE)
INSERT INTO dbo.order_statuses (id, name) VALUES
  (1, N'PENDING'),
  (2, N'CONFIRMED'),
  (3, N'CANCELED'),
  (4, N'FULFILLED');

-- Przykładowe kategorie (predefiniowane)
INSERT INTO dbo.categories (name) VALUES
  (N'Electronics'),
  (N'Books'),
  (N'Home'),
  (N'Toys');

-- Opcjonalnie: przykładowe produkty do szybkich testów
INSERT INTO dbo.products (name, description, unit_price, unit_weight, category_id) VALUES
  (N'USB-C Cable', N'<p>Durable 1m USB-C cable</p>', 29.99, 0.050, (SELECT id FROM dbo.categories WHERE name=N'Electronics')),
  (N'Coffee Mug', N'<p>Ceramic mug 300ml</p>', 19.90, 0.300, (SELECT id FROM dbo.categories WHERE name=N'Home'));
