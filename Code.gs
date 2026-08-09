/*************************************************************
 * Minha Pokédex — Backend (Google Apps Script)
 *
 *   GET  ?action=get            -> devolve toda a coleção salva
 *   POST {action:'save', ...}   -> salva/atualiza uma carta
 *   GET  ?action=liga&name=...  -> preço REAL na Liga Pokémon
 *                                  (único lugar possível: o navegador
 *                                   é bloqueado por CORS, o servidor não)
 *
 * Publicar:
 *   1. Crie uma Planilha Google. (Opcional: cole o ID em SHEET_ID.)
 *   2. Extensões > Apps Script, cole este arquivo, salve.
 *   3. Implantar > Nova implantação > App da Web
 *        Executar como: Eu   |   Quem acessa: Qualquer pessoa
 *   4. Copie a URL /exec e cole no campo "Planilha (Apps Script)" do site.
 *
 * IMPORTANTE (multiusuário): cada pessoa deve publicar o SEU próprio
 * Apps Script e usar a SUA própria planilha. Assim as coleções não se
 * misturam. O site já vem com o campo de URL vazio de propósito.
 *************************************************************/

const SHEET_ID = '';            // opcional
const SHEET_NAME = 'colecao';

// Versão do "leitor" da Liga. Se o site da Liga mudar e o leitor quebrar,
// o app mostra um aviso e você ajusta a função fetchLigaPrice() abaixo.
const LIGA_PARSER_VERSION = 1;

function _sheet() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(['card_id', 'variants_json', 'atualizado_em']); }
  return sh;
}
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'get';

  if (action === 'liga') {
    try {
      const res = fetchLigaPrice(
        e.parameter.name || '', e.parameter.number || '', e.parameter.set || ''
      );
      // res: { price, changed, url }
      return _json({ ok: true, price: res.price, changed: res.changed, url: res.url, v: LIGA_PARSER_VERSION });
    } catch (err) {
      return _json({ ok: false, error: String(err), changed: false });
    }
  }

  try {
    const sh = _sheet();
    const rows = sh.getDataRange().getValues();
    const collection = {};
    for (let i = 1; i < rows.length; i++) {
      const id = rows[i][0]; if (!id) continue;
      try { collection[id] = JSON.parse(rows[i][1]); } catch (_) {}
    }
    return _json({ ok: true, collection: collection });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action !== 'save') return _json({ ok: false, error: 'ação desconhecida' });
    const sh = _sheet();
    const rows = sh.getDataRange().getValues();
    const now = new Date();
    let found = -1;
    for (let i = 1; i < rows.length; i++) if (rows[i][0] === body.card_id) { found = i + 1; break; }
    const json = JSON.stringify(body.variants || {});
    if (found > 0) { sh.getRange(found, 2).setValue(json); sh.getRange(found, 3).setValue(now); }
    else { sh.appendRow([body.card_id, json, now]); }
    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/*************************************************************
 * Preço real da Liga Pokémon (best-effort)
 *
 * Devolve { price, changed, url }:
 *   - price  : menor preço encontrado (R$) ou null
 *   - changed: TRUE quando a página abriu (HTTP 200) mas o leitor NÃO
 *              achou NENHUM preço nem os marcadores esperados -> sinal
 *              de que a Liga mudou o layout e este código precisa de
 *              ajuste. O site mostra um aviso quando isso acontece.
 *   - url    : a URL consultada (p/ você conferir na mão)
 *
 * Como é frágil por natureza (depende do HTML da Liga), rode com
 * moderação (há cache de 6h) e respeite os Termos de Uso do site.
 * O casamento exato por edição/número (N vs F do seu Guia) é o passo
 * fino a evoluir aqui dentro.
 *************************************************************/
function fetchLigaPrice(name, number, setName) {
  const cache = CacheService.getScriptCache();
  const key = 'liga_' + Utilities.base64EncodeWebSafe(name + '|' + number).slice(0, 200);
  const hit = cache.get(key);
  if (hit) return { price: Number(hit), changed: false, url: '(cache)' };

  const url = 'https://www.ligapokemon.com.br/?view=cards/search&card=' + encodeURIComponent(name);
  const resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true, followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const code = resp.getResponseCode();
  if (code !== 200) {
    // erro de rede/bloqueio: não é "layout mudou", é indisponibilidade
    return { price: null, changed: false, url: url };
  }

  const html = resp.getContentText();

  // Marcadores que esperamos existir numa página normal da Liga.
  // Se NENHUM aparecer, provavelmente o layout mudou (changed=true).
  var looksLikeLiga = /ligapokemon/i.test(html) && /(card|preço|preco|R\$)/i.test(html);

  // Extrai todos os "R$ x.xxx,xx" e pega o menor (aprox. "menor preço").
  var matches = html.match(/R\$\s*([\d\.]+,\d{2})/g) || [];

  if (!matches.length) {
    // Página abriu mas não achamos preço nenhum:
    //  - se nem parece a Liga -> layout mudou (avisa)
    //  - se parece a Liga mas a carta não tem oferta -> apenas "sem preço"
    return { price: null, changed: !looksLikeLiga, url: url };
  }

  var min = Infinity;
  matches.forEach(function (m) {
    var num = parseFloat(m.replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.'));
    if (!isNaN(num) && num > 0 && num < min) min = num;
  });
  if (min === Infinity) return { price: null, changed: !looksLikeLiga, url: url };

  cache.put(key, String(min), 21600); // 6h
  return { price: min, changed: false, url: url };
}
