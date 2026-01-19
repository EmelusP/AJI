import { type FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';
import { api } from './services/api';
import type { Category, OrderDetails, OrderItem, Product, Status, Tokens } from './services/api';

type View = 'catalog' | 'checkout' | 'admin' | 'statuses' | 'auth' | 'my_orders';

interface CartItem {
  product: Product;
  quantity: number;
}

interface CheckoutForm {
  user_name: string;
  email: string;
  phone: string;
}

interface EditFormState {
  id: number;
  category_id: number;
  unit_price: string;
  unit_weight: string;
  description: string;
}

interface AuthState extends Tokens {
  username?: string;
  role?: string;
}

const VIEWS: Record<View, string> = {
  catalog: 'Katalog',
  checkout: 'Składanie zamówienia',
  admin: 'Panel pracownika',
  statuses: 'Zamówienia wg statusu',
  auth: 'Logowanie',
  my_orders: 'Moje zamówienia',
};

const STATUS_LABELS: Record<number, string> = {
  1: 'PENDING',
  2: 'CONFIRMED',
  3: 'CANCELED',
  4: 'FULFILLED',
};

const CARD_CLASS = 'card bg-dark border-success text-success';
const CARD_HEADER_CLASS = 'card-header bg-success bg-opacity-25 border-success text-success';
const TABLE_CLASS = 'table table-dark table-striped table-hover align-middle';

const initialCheckout: CheckoutForm = {
  user_name: '',
  email: '',
  phone: '',
};

function formatCurrency(value: number): string {
  return `${value.toFixed(2)} zł`;
}

function calcOrderValue(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

function decodeRoleFromToken(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return undefined;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    const data = JSON.parse(decoded) as { role?: string };
    return data.role;
  } catch {
    return undefined;
  }
}

function App() {
  const [view, setView] = useState<View>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [filters, setFilters] = useState({ search: '', categoryId: '' });
  const [productsError, setProductsError] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(initialCheckout);
  const [checkoutErrors, setCheckoutErrors] = useState<Record<string, string>>({});
  const [orderError, setOrderError] = useState('');

  const [isOptimizing, setIsOptimizing] = useState(false);

  const [auth, setAuth] = useState<AuthState | null>(() => {
    const raw = localStorage.getItem('ajiAuth');
    if (!raw) return null;
    try {
      const stored = JSON.parse(raw) as AuthState;
      if (stored.accessToken && !stored.role) {
        stored.role = decodeRoleFromToken(stored.accessToken);
      }
      return stored;
    } catch {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [registerForm, setRegisterForm] = useState({ username: '', password: '' });
  const [registerError, setRegisterError] = useState('');
  const [registerInfo, setRegisterInfo] = useState('');

  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState('');

  const [pendingOrders, setPendingOrders] = useState<Array<OrderDetails & { totalValue: number }>>([]);
  const [statusOrders, setStatusOrders] = useState<Array<OrderDetails & { totalValue: number }>>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusError, setStatusError] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [myOrders, setMyOrders] = useState<Array<OrderDetails & { totalValue: number }>>([]);
  // opinionsForm maps orderId -> form state
  const [opinionForms, setOpinionForms] = useState<Record<number, { rating: number; content: string }>>({});
  const [opinionError, setOpinionError] = useState('');

  const [authMessage, setAuthMessage] = useState('');
  const [pendingSecureView, setPendingSecureView] = useState<View | null>(null);
  const isStaff = auth?.role === 'PRACOWNIK';

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadStatuses();
  }, []);

  useEffect(() => {
    if (view === 'admin' && auth) {
      loadPendingOrders();
    }
  }, [view, auth]);

  useEffect(() => {
    if (view === 'statuses' && auth && statusFilter) {
      loadOrdersByStatus(statusFilter);
    }
  }, [view, auth, statusFilter]);

  useEffect(() => {
    if (auth?.username) {
      setCheckoutForm((prev) => ({ ...prev, user_name: auth.username! }));
    }
  }, [auth]);

  useEffect(() => {
    if (view === 'my_orders' && auth) {
      loadUserOrders();
    }
  }, [view, auth]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesName = product.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesCategory =
        !filters.categoryId || Number(filters.categoryId) === Number(product.category_id);
      return matchesName && matchesCategory;
    });
  }, [products, filters]);

  const cartValue = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.product.unit_price) * item.quantity, 0);
  }, [cart]);

  async function loadProducts() {
    try {
      const data = await api.fetchProducts();
      setProducts(data);
      setProductsError('');
    } catch (err) {
      setProductsError(err instanceof Error ? err.message : 'Nie udało się pobrać towarów');
    }
  }

  async function loadCategories() {
    try {
      const data = await api.fetchCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStatuses() {
    try {
      const data = await api.fetchStatuses();
      setStatuses(data);
    } catch (err) {
      console.error(err);
    }
  }

  function handleViewChange(target: View) {
    if ((target === 'admin' || target === 'statuses') && !isStaff) {
      setAuthMessage('Zaloguj się jako pracownik, aby korzystać z tej sekcji.');
      setPendingSecureView(target);
      setView('auth');
      return;
    }
    setPendingSecureView(null);
    setAuthMessage('');
    setView(target);
  }

  function addToCart(product: Product) {
    setCart((current) => {
      const exists = current.find((item) => item.product.id === product.id);
      if (exists) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((current) =>
      current.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }

  function changeQuantity(productId: number, delta: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: number) {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  }

  function validateOrder(): boolean {
    const errors: Record<string, string> = {};
    if (!checkoutForm.user_name.trim()) {
      errors.user_name = 'Podaj nazwę użytkownika';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkoutForm.email)) {
      errors.email = 'Podaj poprawny email';
    }
    if (!/^[0-9+\-\s]{6,}$/.test(checkoutForm.phone)) {
      errors.phone = 'Podaj poprawny numer telefonu';
    }
    if (cart.length === 0) {
      errors.items = 'Dodaj przynajmniej jeden towar';
    }
    setCheckoutErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderError('');
    if (!validateOrder()) return;

    const payload = {
      user_name: checkoutForm.user_name.trim(),
      email: checkoutForm.email.trim(),
      phone: checkoutForm.phone.trim(),
      approved_at: null,
      items: cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      })),
    };

    try {
      await api.createOrder(payload);
      setCart([]);
      setCheckoutForm(initialCheckout);
      setCheckoutErrors({});
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Nie udało się złożyć zamówienia');
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    try {
      const tokens = await api.login(loginForm);
      const role = decodeRoleFromToken(tokens.accessToken);
      const authState: AuthState = { ...tokens, username: loginForm.username.trim(), role };
      setAuth(authState);
      localStorage.setItem('ajiAuth', JSON.stringify(authState));
      setLoginForm({ username: '', password: '' });
      setAuthMessage('');
      if (pendingSecureView) {
        setView(pendingSecureView);
        setPendingSecureView(null);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Nie udało się zalogować');
    }
  }

  function handleLogout() {
    setAuth(null);
    localStorage.removeItem('ajiAuth');
    setPendingOrders([]);
    setStatusOrders([]);
    setPendingSecureView(null);
    setAuthMessage('');
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterError('');
    setRegisterInfo('');
    const username = registerForm.username.trim();
    const password = registerForm.password.trim();
    if (!username || password.length < 6) {
      setRegisterError('Podaj login i hasło (min. 6 znaków).');
      return;
    }
    try {
      await api.register({ username, password });
      setRegisterForm({ username: '', password: '' });
      setRegisterInfo('Konto utworzone. Zaloguj się powyżej.');
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Nie udało się zarejestrować');
    }
  }

  function startEdit(product: Product) {
    if (!isStaff) {
      setAuthMessage('Edytowanie produktów dostępne jest tylko dla pracownika.');
      setPendingSecureView('catalog');
      setView('auth');
      return;
    }
    setEditForm({
      id: product.id,
      category_id: product.category_id,
      unit_price: Number(product.unit_price).toFixed(2),
      unit_weight: Number(product.unit_weight).toFixed(3),
      description: product.description,
    });
    setEditError('');
  }

  function cancelEdit() {
    setEditForm(null);
    setEditError('');
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) return;
    if (!isStaff || !auth) {
      setAuthMessage('Zapis zmian produktu wymaga konta pracownika.');
      setPendingSecureView('catalog');
      setView('auth');
      return;
    }
    try {
      const payload = {
        category_id: Number(editForm.category_id),
        unit_price: Number(editForm.unit_price),
        unit_weight: Number(editForm.unit_weight),
        description: editForm.description,
      };
      await api.updateProduct(auth.accessToken, editForm.id, payload);
      setEditError('');
      setEditForm(null);
      loadProducts();
    } catch (err) {
      if (err && typeof err === 'object' && 'details' in err && (err as { details?: unknown }).details) {
        const details = (err as { details?: unknown }).details;
        if (Array.isArray(details)) {
          const message = details.map((d: { message?: string }) => d?.message).filter(Boolean).join(', ');
          setEditError(message || 'Błąd walidacji');
        } else {
          setEditError(String(details));
        }
      } else {
        setEditError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian');
      }
    }
  }

  async function loadPendingOrders() {
    if (!isStaff || !auth) {
      setAuthMessage('Zaloguj się jako pracownik, aby zobaczyć zamówienia.');
      setPendingSecureView('admin');
      setView('auth');
      return;
    }
    setLoadingOrders(true);
    setStatusError('');
    try {
      const headers = await api.fetchOrders(auth.accessToken);
      const awaiting = headers.filter((order) => ![3, 4].includes(order.status_id));
      const detailed: Array<OrderDetails & { totalValue: number }> = [];
      for (const order of awaiting) {
        const full = await api.fetchOrderDetails(auth.accessToken, order.id);
        detailed.push({ ...full, totalValue: calcOrderValue(full.items) });
      }
      setPendingOrders(detailed);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Nie udało się pobrać zamówień');
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadOrdersByStatus(statusValue: string) {
    if (!statusValue) return;
    if (!isStaff || !auth) {
      setAuthMessage('Zaloguj się jako pracownik, aby filtrować zamówienia.');
      setPendingSecureView('statuses');
      setView('auth');
      return;
    }
    setLoadingOrders(true);
    setStatusError('');
    try {
      const headers = await api.fetchOrdersByStatus(auth.accessToken, Number(statusValue));
      const detailed: Array<OrderDetails & { totalValue: number }> = [];
      for (const order of headers) {
        const full = await api.fetchOrderDetails(auth.accessToken, order.id);
        detailed.push({ ...full, totalValue: calcOrderValue(full.items) });
      }
      setStatusOrders(detailed);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Nie udało się pobrać zamówień wg statusu');
    } finally {
      setLoadingOrders(false);
    }
  }

  async function updateOrderStatus(orderId: number, nextStatus: number, currentStatus?: number) {
    if (!isStaff || !auth) {
      setAuthMessage('Zaloguj się jako pracownik, aby zmieniać statusy.');
      setPendingSecureView('admin');
      setView('auth');
      return;
    }
    try {
      if (auth && nextStatus === 4 && currentStatus === 1) {
        await api.changeOrderStatus(auth.accessToken, orderId, 2);
      }
      await api.changeOrderStatus(auth.accessToken, orderId, nextStatus);
      await loadPendingOrders();
      if (view === 'statuses' && statusFilter) {
        await loadOrdersByStatus(statusFilter);
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Nie udało się zmienić statusu');
    }
  }

  async function handleOptimize() {
    if (!editForm || !auth) return;
    setIsOptimizing(true);
    setEditError('');

    try {
      const response = await api.getSeoDescription(auth.accessToken, editForm.id);

      const newDescription = response.description || response.message || '';

      if (newDescription) {
        setEditForm(prev => prev ? { ...prev, description: newDescription } : null);
      } else {
        setEditError('Otrzymano pusty opis z serwera.');
      }
    } catch (err) {
      setEditError('Nie udało się pobrać opisu SEO.');
    } finally {
      setIsOptimizing(false);
    }
  }

  async function loadUserOrders() {
    if (!auth) {
      setAuthMessage('Zaloguj się, aby zobaczyć swoje zamówienia.');
      setPendingSecureView('my_orders');
      setView('auth');
      return;
    }
    setLoadingOrders(true);
    try {
      const headers = await api.fetchUserOrders(auth.accessToken, auth.username || '');
      const detailed: Array<OrderDetails & { totalValue: number }> = [];
      for (const order of headers) {
        const full = await api.fetchOrderDetails(auth.accessToken, order.id);
        detailed.push({ ...full, totalValue: calcOrderValue(full.items) });
      }
      setMyOrders(detailed);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  }

  function toggleOpinionForm(orderId: number) {
    setOpinionForms(prev => ({
      ...prev,
      [orderId]: prev[orderId] ? { ...prev[orderId] } : { rating: 5, content: '' }
    }));
  }

  async function submitOpinion(orderId: number) {
    if (!auth || !opinionForms[orderId]) return;
    setOpinionError('');
    try {
      const { rating, content } = opinionForms[orderId];
      await api.addOpinion(auth.accessToken, orderId, rating, content);
      // Refresh orders to show the new opinion
      await loadUserOrders();
      // Clear form
      setOpinionForms(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    } catch (err) {
      setOpinionError(err instanceof Error ? err.message : 'Nie udało się dodać opinii');
    }
  }

  function renderFilters() {
    return (
      <div className={`${CARD_CLASS} mb-3`}>
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-6">
              <label className="form-label">Szukaj po nazwie</label>
              <input
                type="text"
                className="form-control bg-dark text-light border-success"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="np. kabel"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Kategoria</label>
              <select
                className="form-select bg-dark text-light border-success"
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              >
                <option value="">Wszystkie</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-success w-100"
                onClick={() => setFilters({ search: '', categoryId: '' })}
              >
                Wyczyść
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderProductsTable() {
    return (
      <div className={CARD_CLASS}>
        <div className={`${CARD_HEADER_CLASS} d-flex justify-content-between align-items-center`}>
          <strong>Towary</strong>
          <button className="btn btn-sm btn-outline-success" onClick={loadProducts}>
            Odśwież
          </button>
        </div>
        <div className="card-body p-0">
          {productsError && <p className="text-danger small m-3">{productsError}</p>}
          <div className="table-responsive">
            <table className={`${TABLE_CLASS} mb-0`}>
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Opis</th>
                  <th>Cena</th>
                  <th className="text-end">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4">
                      Brak towarów spełniających warunki filtrowania.
                    </td>
                  </tr>
                )}
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="fw-semibold text-light">{product.name}</div>
                      <small className="text-light opacity-75">{product.category_name}</small>
                    </td>
                    <td>
                      <div
                        className="small text-light opacity-75"
                        dangerouslySetInnerHTML={{ __html: product.description }}
                      />
                    </td>
                    <td>{formatCurrency(Number(product.unit_price))}</td>
                    <td className="text-end">
                      <div className="btn-group">
                        <button className="btn btn-sm btn-success" onClick={() => addToCart(product)}>
                          Kup
                        </button>
                        {isStaff && (
                          <button
                            className="btn btn-sm btn-outline-light"
                            onClick={() => startEdit(product)}
                          >
                            Edytuj
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderEditForm() {
    if (!editForm) return null;
    return (
      <div className={`${CARD_CLASS} mt-3`}>
        <div className={CARD_HEADER_CLASS}>Edycja towaru #{editForm.id}</div>
        <div className="card-body">
          {!auth && (
            <p className="text-muted small">
              Zapis zmian wymaga zalogowania jako pracownik.
            </p>
          )}
          {editError && <p className="text-danger small">{editError}</p>}

          <form className="row g-3" onSubmit={submitEdit}>

            <div className="col-12">
              <label className="form-label">Opis produktu</label>
              <textarea
                className="form-control bg-dark text-light border-success"
                rows={5}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                required
              />
              <div className="form-text text-light opacity-50 mb-2">
                Możesz używać znaczników HTML.
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning"
                onClick={handleOptimize}
                disabled={isOptimizing}
              >
                {isOptimizing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Generowanie opisu SEO...
                  </>
                ) : (
                  'Optymalizuj opis'
                )}
              </button>
            </div>

            <div className="col-md-4">
              <label className="form-label">Kategoria</label>
              <select
                className="form-select bg-dark text-light border-success"
                value={editForm.category_id}
                onChange={(e) => setEditForm({ ...editForm, category_id: Number(e.target.value) })}
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Cena (zł)</label>
              <input
                type="number"
                step="0.01"
                className="form-control bg-dark text-light border-success"
                value={editForm.unit_price}
                onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Waga (kg)</label>
              <input
                type="number"
                step="0.001"
                className="form-control bg-dark text-light border-success"
                value={editForm.unit_weight}
                onChange={(e) => setEditForm({ ...editForm, unit_weight: e.target.value })}
                required
              />
            </div>
            <div className="col-12 d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-light" onClick={cancelEdit}>
                Anuluj
              </button>
              <button type="submit" className="btn btn-success">
                Zapisz zmiany
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderCartCard(showButton = true) {
    return (
      <div className={`${CARD_CLASS} mb-3`}>
        <div className={`${CARD_HEADER_CLASS} d-flex justify-content-between align-items-center`}>
          <strong>Koszyk</strong>
          <span className="badge bg-success bg-opacity-50">{cart.length} pozycji</span>
        </div>
        <div className="card-body">
          {cart.length === 0 ? (
            <p className="text-success mb-0">Koszyk jest pusty.</p>
          ) : (
            <ul className="list-group list-group-flush mb-3">
              {cart.map((item) => (
                <li
                  key={item.product.id}
                  className="list-group-item bg-dark text-light border-success d-flex justify-content-between align-items-center"
                >
                  <div>
                    <div className="fw-semibold text-light">{item.product.name}</div>
                    <div className="small text-light opacity-75">
                      {item.quantity} x {formatCurrency(Number(item.product.unit_price))}
                    </div>
                  </div>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-light" onClick={() => changeQuantity(item.product.id, -1)}>
                      -
                    </button>
                    <button className="btn btn-outline-light" onClick={() => changeQuantity(item.product.id, 1)}>
                      +
                    </button>
                    <button className="btn btn-outline-danger" onClick={() => removeFromCart(item.product.id)}>
                      Usuń
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="d-flex justify-content-between">
            <span>Suma</span>
            <strong>{formatCurrency(cartValue)}</strong>
          </div>
          {showButton && (
            <button
              className="btn btn-success w-100 mt-3"
              onClick={() => setView('checkout')}
              disabled={cart.length === 0}
            >
              Przejdź do zamówienia
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderCheckout() {
    return (
      <div className={CARD_CLASS}>
        <div className={CARD_HEADER_CLASS}>
          <strong>Składanie zamówienia</strong>
        </div>
        <div className="card-body">
          {cart.length === 0 ? (
            <p className="text-success">Twój koszyk jest pusty.</p>
          ) : (
            <div className="table-responsive mb-4">
              <table className={TABLE_CLASS}>
                <thead>
                  <tr>
                    <th>Towar</th>
                    <th>Ilość</th>
                    <th>Łączna cena</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.product.id}>
                      <td>{item.product.name}</td>
                      <td style={{ maxWidth: 150 }}>
                        <div className="input-group input-group-sm">
                          <button className="btn btn-outline-light" onClick={() => changeQuantity(item.product.id, -1)}>
                            -
                          </button>
                          <input
                            type="number"
                            className="form-control text-center"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                          />
                          <button className="btn btn-outline-light" onClick={() => changeQuantity(item.product.id, 1)}>
                            +
                          </button>
                        </div>
                      </td>
                      <td>{formatCurrency(Number(item.product.unit_price) * item.quantity)}</td>
                      <td>
                        <button className="btn btn-link text-danger p-0" onClick={() => removeFromCart(item.product.id)}>
                          Usuń
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form onSubmit={submitOrder} className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Nazwa użytkownika</label>
              <input
                type="text"
                className={`form-control bg-dark text-light border-success ${checkoutErrors.user_name ? 'is-invalid' : ''}`}
                value={checkoutForm.user_name}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, user_name: e.target.value })}
                disabled={!!auth}
              />
              {checkoutErrors.user_name && <div className="invalid-feedback">{checkoutErrors.user_name}</div>}
            </div>
            <div className="col-md-4">
              <label className="form-label">Email</label>
              <input
                type="email"
                className={`form-control bg-dark text-light border-success ${checkoutErrors.email ? 'is-invalid' : ''}`}
                value={checkoutForm.email}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
              />
              {checkoutErrors.email && <div className="invalid-feedback">{checkoutErrors.email}</div>}
            </div>
            <div className="col-md-4">
              <label className="form-label">Telefon</label>
              <input
                type="tel"
                className={`form-control bg-dark text-light border-success ${checkoutErrors.phone ? 'is-invalid' : ''}`}
                value={checkoutForm.phone}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
              />
              {checkoutErrors.phone && <div className="invalid-feedback">{checkoutErrors.phone}</div>}
            </div>
            <div className="col-12 d-flex justify-content-end align-items-center gap-3">
              <div>
                <span className="text-success">Łączna cena:</span>{' '}
                <strong className="text-success">{formatCurrency(cartValue)}</strong>
              </div>
              <button type="submit" className="btn btn-success" disabled={cart.length === 0}>
                Wyślij zamówienie
              </button>
            </div>
            {checkoutErrors.items && (
              <div className="col-12">
                <p className="text-warning small mb-0">{checkoutErrors.items}</p>
              </div>
            )}
          </form>
          {orderError && <p className="text-danger mt-3 mb-0 small">{orderError}</p>}
        </div>
      </div>
    );
  }

  function renderPendingOrders() {
    if (!isStaff || !auth) {
      return <p className="text-info">Zaloguj się jako pracownik, aby zobaczyć zamówienia.</p>;
    }
    return (
      <div className={`${CARD_CLASS} mb-4`}>
        <div className={`${CARD_HEADER_CLASS} d-flex justify-content-between align-items-center`}>
          <strong>Niezrealizowane zamówienia</strong>
          <button className="btn btn-sm btn-outline-success" onClick={loadPendingOrders}>
            Odśwież
          </button>
        </div>
        <div className="card-body">
          {loadingOrders && <div className="text-muted">Wczytywanie...</div>}
          {statusError && <p className="text-danger small mb-2">{statusError}</p>}
          {!loadingOrders && pendingOrders.length === 0 && (
            <p className="text-success mb-0">Brak oczekujących zamówień.</p>
          )}
          {pendingOrders.map((order) => (
            <div key={order.id} className="border rounded p-3 mb-3">
              <div className="d-flex justify-content-between">
                <div>
                  <div className="fw-semibold">Zamówienie #{order.id}</div>
                  <div className="small text-success">
                    Data zatwierdzenia:{' '}
                    {order.approved_at ? new Date(order.approved_at).toLocaleString() : '—'}
                  </div>
                  <div className="small text-success">
                    Status: {STATUS_LABELS[order.status_id]}
                  </div>
                  <div className="small text-success">
                    Klient: {order.user_name} / {order.email} / {order.phone}
                  </div>
                </div>
                <div className="text-end">
                  <div>
                    Wartość: <strong>{formatCurrency(order.totalValue)}</strong>
                  </div>
                  <div className="btn-group mt-2">
                    <button
                      className="btn btn-sm btn-outline-success"
                      onClick={() => updateOrderStatus(order.id, 4, order.status_id)}
                    >
                      ZREALIZOWANE
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => updateOrderStatus(order.id, 3)}
                    >

                      ANULUJ
                    </button>
                  </div>
                </div>
              </div>
              <ul className="list-group list-group-flush mt-3 mb-3">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="list-group-item bg-dark text-success border-success d-flex justify-content-between"
                  >
                    <span>{item.product_name}</span>
                    <span>{item.quantity} szt.</span>
                  </li>
                ))}
              </ul>
              {(order.opinions && order.opinions.length > 0) && (
                <div className="mt-2 p-2 border border-info rounded bg-dark">
                  <strong className="text-info small">Opinia klienta:</strong>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-info text-dark">{order.opinions[0].rating}/5</span>
                    <span className="small text-light fst-italic">"{order.opinions[0].content}"</span>
                  </div>
                  <div className="text-end">
                    <small className="text-muted" style={{ fontSize: '0.7em' }}>
                      {new Date(order.opinions[0].created_at).toLocaleString()}
                    </small>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderOrdersByStatus() {
    if (!isStaff || !auth) {
      return <p className="text-info">Zaloguj się jako pracownik, aby filtrować zamówienia po statusie.</p>;
    }
    return (
      <div className={CARD_CLASS}>
        <div className={CARD_HEADER_CLASS}>Zamówienia wg statusu</div>
        <div className="card-body">
          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <label className="form-label">Status</label>
              <select
                className="form-select bg-dark text-light border-success"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Wybierz status</option>
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <button
                className="btn btn-success w-100"
                onClick={() => loadOrdersByStatus(statusFilter)}
                disabled={!statusFilter}
              >
                Pokaż
              </button>
            </div>
          </div>
          {statusError && <p className="text-danger small">{statusError}</p>}
          {loadingOrders && <p className="text-muted">Wczytywanie...</p>}
          {!loadingOrders && statusOrders.length === 0 && statusFilter && (
            <p className="text-success">Brak zamówień dla wybranego statusu.</p>
          )}
          {statusOrders.length > 0 && (
            <div className="table-responsive bg-dark text-light p-3 rounded border border-success">
              <table className="table table-dark table-striped table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-success">ID</th>
                    <th className="text-success">Data zatwierdzenia</th>
                    <th className="text-success">Wartość</th>
                    <th className="text-success">Klient</th>
                  </tr>
                </thead>
                <tbody>
                  {statusOrders.map((order) => (
                    <>
                      <tr key={order.id}>
                        <td className="text-success">#{order.id}</td>
                        <td className="text-success">
                          {order.approved_at ? new Date(order.approved_at).toLocaleString() : '—'}
                        </td>
                        <td className="text-success">{formatCurrency(order.totalValue)}</td>
                        <td className="text-success fw-semibold">
                          {order.user_name}
                          <div className="small text-success">{order.email}</div>
                          <div className="small text-success">{order.phone}</div>
                        </td>
                      </tr>
                      {order.opinions && order.opinions.length > 0 && (
                        <tr key={`op-${order.id}`}>
                          <td colSpan={4} className="bg-dark border-success">
                            <div className="p-2 border border-info rounded" style={{ marginLeft: '20px' }}>
                              <strong className="text-info small">Opinia klienta: </strong>
                              <span className="badge bg-info text-dark me-2">{order.opinions[0].rating}/5</span>
                              <span className="small text-light fst-italic">"{order.opinions[0].content}"</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderClientOrders() {
    if (!auth) return renderLoginCard();

    return (
      <div className={CARD_CLASS}>
        <div className={`${CARD_HEADER_CLASS} d-flex justify-content-between align-items-center`}>
          <strong>Moje zamówienia</strong>
          <button className="btn btn-sm btn-outline-success" onClick={loadUserOrders}>
            Odśwież
          </button>
        </div>
        <div className="card-body">
          {loadingOrders && <div className="text-muted">Wczytywanie...</div>}
          {!loadingOrders && myOrders.length === 0 && (
            <p className="text-success">Nie masz jeszcze żadnych zamówień.</p>
          )}
          {myOrders.map(order => {
            const canRate = [3, 4].includes(order.status_id);
            const hasOpinion = order.opinions && order.opinions.length > 0;
            const showForm = !!opinionForms[order.id];
            const opinion = hasOpinion ? order.opinions![0] : null;

            return (
              <div key={order.id} className="border rounded p-3 mb-3 border-secondary">
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="fw-semibold text-success">Zamówienie #{order.id}</div>
                    <div className="small text-light opacity-75">
                      Status: <span className="text-white">{order.status_name || STATUS_LABELS[order.status_id]}</span>
                    </div>
                    <div className="small text-light opacity-75">
                      Data: {order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div className="text-end text-success fw-bold">
                    {formatCurrency(order.totalValue)}
                  </div>
                </div>

                <ul className="list-group list-group-flush mt-2 mb-3">
                  {order.items.map(item => (
                    <li key={item.id} className="list-group-item bg-dark text-light border-secondary py-1 px-0">
                      <small>{item.product_name} x {item.quantity}</small>
                    </li>
                  ))}
                </ul>

                {hasOpinion && opinion && (
                  <div className="alert alert-success bg-opacity-10 border-success p-2">
                    <strong>Twoja opinia:</strong> {opinion.rating}/5
                    <div className="small fst-italic">{opinion.content}</div>
                  </div>
                )}

                {!hasOpinion && canRate && !showForm && (
                  <button className="btn btn-sm btn-outline-warning" onClick={() => toggleOpinionForm(order.id)}>
                    Dodaj opinię
                  </button>
                )}

                {showForm && (
                  <div className="mt-2 p-2 border border-warning rounded">
                    <h6 className="text-warning small">Twoja opinia</h6>
                    <div className="mb-2">
                      <label className="form-label small text-light">Ocena (1-5)</label>
                      <select
                        className="form-select form-select-sm bg-dark text-light border-warning"
                        value={opinionForms[order.id]?.rating || 5}
                        onChange={e => setOpinionForms(prev => ({ ...prev, [order.id]: { ...prev[order.id], rating: Number(e.target.value) } }))}
                      >
                        {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label small text-light">Treść</label>
                      <textarea
                        className="form-control form-control-sm bg-dark text-light border-warning"
                        rows={2}
                        value={opinionForms[order.id]?.content || ''}
                        onChange={e => setOpinionForms(prev => ({ ...prev, [order.id]: { ...prev[order.id], content: e.target.value } }))}
                      />
                    </div>
                    {opinionError && <p className="text-danger small">{opinionError}</p>}
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-warning" onClick={() => submitOpinion(order.id)}>Wyślij</button>
                      <button className="btn btn-sm btn-outline-light" onClick={() => toggleOpinionForm(order.id)}>Anuluj</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderLoginCard(includeRegister = false) {
    return (
      <div className={CARD_CLASS}>
        <div className={CARD_HEADER_CLASS}>Logowanie</div>
        <div className="card-body">
          {auth ? (
            <>
              <p className="mb-2">
                Zalogowano jako <strong>{auth.username || 'pracownik'}</strong>
              </p>
              <button className="btn btn-outline-danger w-100" onClick={handleLogout}>
                Wyloguj
              </button>
            </>
          ) : (
            <>
              {authMessage && <p className="text-success small">{authMessage}</p>}
              <form onSubmit={handleLogin} className="vstack gap-2 mb-3">
                <label className="form-label text-light">Login</label>
                <input
                  type="text"
                  className="form-control bg-dark text-light border-success"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  required
                />
                <label className="form-label text-light">Hasło</label>
                <input
                  type="password"
                  className="form-control bg-dark text-light border-success"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
                {loginError && <p className="text-danger small mb-0">{loginError}</p>}
                <button className="btn btn-outline-primary" type="submit">
                  Zaloguj
                </button>
              </form>
              {includeRegister && (
                <>
                  <hr />
                  <form onSubmit={handleRegister} className="vstack gap-2">
                    <h6 className="text-light">Rejestracja</h6>
                    <label className="form-label text-light">Nazwa użytkownika</label>
                    <input
                      type="text"
                      className="form-control bg-dark text-light border-success"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      required
                    />
                    <label className="form-label text-light">Hasło (min. 6 znaków)</label>
                    <input
                      type="password"
                      className="form-control bg-dark text-light border-success"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                    />
                    {registerError && <p className="text-danger small mb-0">{registerError}</p>}
                    {registerInfo && <p className="text-success small mb-0">{registerInfo}</p>}
                    <button className="btn btn-success" type="submit">
                      Zarejestruj
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-dark text-light">
      <div className="container py-4">
        <header className="mb-4">
          <h1 className="h3 mb-1 text-success">AJI Shop</h1>
        </header>

        <nav className="nav nav-pills flex-wrap gap-2 mb-4">
          {Object.entries(VIEWS).map(([key, label]) => (
            <button
              key={key}
              className={`btn ${view === key ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => handleViewChange(key as View)}
            >
              {label}
            </button>
          ))}
        </nav>

        {view === 'catalog' && (
          <div className="row g-4">
            <div className="col-lg-8">
              {renderFilters()}
              {renderProductsTable()}
              {renderEditForm()}
            </div>
            <div className="col-lg-4">
              {renderCartCard(true)}
            </div>
          </div>
        )}

        {view === 'checkout' && (
          <div className="row g-4">
            <div className="col-lg-8">{renderCheckout()}</div>
            <div className="col-lg-4">
              {renderCartCard(false)}
              <button className="btn btn-outline-secondary w-100" onClick={() => setView('catalog')}>
                Powrót do katalogu
              </button>
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="row g-4">
            <div className="col-lg-8">{renderPendingOrders()}</div>
            <div className="col-lg-4">{renderLoginCard()}</div>
          </div>
        )}

        {view === 'statuses' && (
          <div className="row g-4">
            <div className="col-lg-8">{renderOrdersByStatus()}</div>
            <div className="col-lg-4">{renderLoginCard()}</div>
          </div>
        )}

        {view === 'my_orders' && (
          <div className="row g-4">
            <div className="col-lg-8">{renderClientOrders()}</div>
            <div className="col-lg-4">
              {renderLoginCard()}
              <div className="mt-3">
                <button className="btn btn-outline-secondary w-100" onClick={() => setView('catalog')}>
                  Wróć do sklepu
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'auth' && (
          <div className="row g-4">
            <div className="col-lg-6">{renderLoginCard(true)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
