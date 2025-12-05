const axios = require('axios');

// Generuje SEO‑przyjazny opis HTML dla produktu.
// Jeśli skonfigurowano LLM (zmienne LLM_*), wywołuje model językowy.
// W przeciwnym razie zwraca prosty opis oparty na szablonie (fallback).
async function generateSeoDescription(product) {
  const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL = 'mixtral-8x7b-32768' } = process.env;
  const useLLM = LLM_BASE_URL && LLM_API_KEY;

  const prompt = `Create a concise SEO-friendly HTML snippet (150-200 words) describing this product.
Name: ${product.name}
Category: ${product.category_name || product.category_id}
Price: ${product.unit_price}
Weight: ${product.unit_weight} kg
Existing description (HTML allowed): ${product.description}
Requirements: 
- Use semantic HTML (h2, p, ul/li). 
- Include relevant keywords naturally. 
- Avoid promotional claims and avoid repeating brand names.
- Polish language.`;

  if (useLLM) {
    try {
      const response = await axios.post(
        `${LLM_BASE_URL}/chat/completions`,
        {
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful assistant for e‑commerce SEO.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        },
        { headers: { Authorization: `Bearer ${LLM_API_KEY}` } }
      );
      const content = response?.data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (err) {
      // W przypadku błędu wzywania LLM – użyj fallbacku poniżej
    }
  }

  // Fallback: prosty, semantyczny opis produktu po polsku
  return `
  <section class="product-seo">
    <h2>${escapeHtml(product.name)} – opis i najważniejsze cechy</h2>
    <p>${stripHtml(product.description).slice(0, 400)}</p>
    <ul>
      <li>Kategoria: ${escapeHtml(product.category_name || String(product.category_id))}</li>
      <li>Cena: ${Number(product.unit_price).toFixed(2)} zł</li>
      <li>Waga: ${Number(product.unit_weight)} kg</li>
    </ul>
    <p>Sprawdź szczegóły i dostępność w naszym sklepie online.</p>
  </section>`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(html = '') {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { generateSeoDescription };
