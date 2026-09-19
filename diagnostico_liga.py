"""
DIAGNÓSTICO DA LIGA POKÉMON — roda uma vez (no GitHub Actions e/ou na sua máquina).

Mesmo papel do descobrir.py no Orçado x Realizado: antes de escrever o coletor
definitivo eu preciso ver COMO a Liga entrega os dados, e principalmente se ela
deixa o GitHub Actions entrar (a CAIXA, por exemplo, bloqueia os IPs do Actions).

Para cada URL ele tenta de dois jeitos:
    A) HTTP puro (requests)            -> o ideal: leve, dá pra rodar 5x/dia
    B) Navegador headless (Playwright) -> plano B, se o A for bloqueado

E grava em diagnostico_liga/:
    resumo.json / resumo.txt   o que funcionou, bloqueios, variáveis JS achadas
    *_requests.html            HTML cru do método A
    *_playwright.html/.txt     HTML renderizado e texto visível do método B
    *_rede.json                chamadas XHR/fetch que a página dispara (método B)
    *.png                      print da tela (pra ver se caiu em captcha)

Uso local:
    pip install -r scraper/requirements.txt
    python -m playwright install chromium
    python scraper/diagnostico_liga.py
    (opcional) python scraper/diagnostico_liga.py "<url edição>" "<url carta>"

Nenhum login é feito; são só páginas públicas, com pausa entre os acessos.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

import requests

SAIDA = Path("diagnostico_liga")
BASE = "https://www.ligapokemon.com.br/"

URL_EDICOES = BASE + "?view=cards/edicoes"
URL_EDICAO = os.environ.get("URL_EDICAO") or BASE + "?view=cards/search&card=ed=MEP"
URL_CARTA = os.environ.get("URL_CARTA") or (
    BASE + "?view=cards/card&card=Alakazam%20%5BStaff%5D%20(003b%2F%E2%88%9E)&ed=MEP&num=003b"
)

CABECALHOS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

MARCAS_BLOQUEIO = [
    "just a moment", "cf-chl", "challenge-platform", "attention required",
    "access denied", "captcha", "verifique que você é humano", "ddos",
]

TERMOS = [
    "cards_stock", "cards_editions", "cards_stores", "idioma", "qualid",
    "Near Mint", "Português", "Inglês", "Reverse Foil", "Foil",
    "menor", "preco", "price", "data-src", "lazy",
]


# ------------------------------------------------------------------ análise
def analisar_html(html: str) -> dict:
    baixo = html.lower()
    titulo = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)

    # variáveis JS globais grandes: é onde a Liga costuma embutir cartas/estoque
    variaveis = []
    for m in re.finditer(r"\bvar\s+([A-Za-z_]\w*)\s*=\s*([\[{])", html):
        nome, ini = m.group(1), m.start(2)
        fim = html.find("</script>", ini)
        trecho = html[ini: fim if fim > 0 else ini + 200000]
        variaveis.append({
            "nome": nome,
            "tamanho_aprox": len(trecho),
            "amostra": trecho[:1500],
        })
    variaveis.sort(key=lambda v: -v["tamanho_aprox"])

    precos = re.findall(r"R\$\s*[\d\.]+,\d{2}", html)
    ancoras = re.findall(r"\(#?\s*\d{1,4}[a-z]?\s*/[^)\n<]{0,12}\)", html)
    imagens = sorted(set(re.findall(
        r"(?:https?:)?//[^\"'\s)]+?\.(?:jpg|jpeg|png|webp)", html, re.I)))

    return {
        "titulo": (titulo.group(1).strip()[:200] if titulo else None),
        "tamanho": len(html),
        "bloqueio_detectado": [m for m in MARCAS_BLOQUEIO if m in baixo],
        "qtd_precos_em_texto": len(precos),
        "amostra_precos": precos[:15],
        "qtd_ancoras_carta": len(ancoras),
        "amostra_ancoras": ancoras[:10],
        "qtd_imagens": len(imagens),
        "amostra_imagens": imagens[:25],
        "termos": {t: baixo.count(t.lower()) for t in TERMOS},
        "variaveis_js": variaveis[:25],
    }


# ------------------------------------------------------------------ método A
def via_requests(rotulo: str, url: str, sessao: requests.Session) -> dict:
    info = {"metodo": "requests", "url": url}
    try:
        r = sessao.get(url, headers=CABECALHOS, timeout=40, allow_redirects=True)
        info.update({
            "status": r.status_code,
            "url_final": r.url,
            "servidor": r.headers.get("server"),
            "cf_ray": r.headers.get("cf-ray"),
            "content_type": r.headers.get("content-type"),
        })
        r.encoding = r.apparent_encoding or r.encoding
        (SAIDA / f"{rotulo}_requests.html").write_text(r.text, encoding="utf-8")
        info["analise"] = analisar_html(r.text)
    except Exception as e:  # noqa: BLE001
        info["erro"] = repr(e)
    return info


# ------------------------------------------------------------------ método B
def via_playwright(rotulo: str, url: str, navegador) -> dict:
    info = {"metodo": "playwright", "url": url}
    rede: list[dict] = []
    contexto = navegador.new_context(
        locale="pt-BR", user_agent=CABECALHOS["User-Agent"],
        viewport={"width": 1366, "height": 900},
    )
    pagina = contexto.new_page()

    def ao_responder(resp):
        req = resp.request
        if req.resource_type not in {"xhr", "fetch", "document", "script"}:
            return
        item = {
            "tipo": req.resource_type, "metodo": req.method, "url": resp.url[:500],
            "status": resp.status,
            "content_type": resp.headers.get("content-type", ""),
            "post": (req.post_data or "")[:600],
        }
        if req.resource_type in {"xhr", "fetch"}:
            try:
                corpo = resp.text()
                item["tamanho"] = len(corpo)
                item["amostra"] = corpo[:3000]
            except Exception:  # noqa: BLE001
                pass
        rede.append(item)

    pagina.on("response", ao_responder)
    try:
        resp = pagina.goto(url, wait_until="domcontentloaded", timeout=60000)
        info["status"] = resp.status if resp else None
        # dá tempo de um eventual desafio do Cloudflare se resolver sozinho
        pagina.wait_for_timeout(8000)
        # rola até o fim e tenta "exibir mais" (paginação por AJAX das edições)
        for _ in range(4):
            pagina.mouse.wheel(0, 6000)
            pagina.wait_for_timeout(1200)
            for seletor in ["text=/exibir mais/i", "text=/ver mais/i",
                            "text=/carregar mais/i", ".exibir-mais"]:
                try:
                    botao = pagina.locator(seletor).first
                    if botao.is_visible(timeout=500):
                        botao.click(timeout=2000)
                        pagina.wait_for_timeout(2500)
                        info.setdefault("cliques", []).append(seletor)
                        break
                except Exception:  # noqa: BLE001
                    continue
        info["url_final"] = pagina.url
        html = pagina.content()
        (SAIDA / f"{rotulo}_playwright.html").write_text(html, encoding="utf-8")
        info["analise"] = analisar_html(html)
        try:
            texto = pagina.inner_text("body")
            (SAIDA / f"{rotulo}_playwright.txt").write_text(texto, encoding="utf-8")
            info["ancoras_no_texto"] = len(re.findall(r"\(#\s*\d{1,4}[a-z]?\s*/", texto))
        except Exception:  # noqa: BLE001
            pass
        try:
            pagina.screenshot(path=str(SAIDA / f"{rotulo}.png"), full_page=False)
        except Exception:  # noqa: BLE001
            pass
    except Exception as e:  # noqa: BLE001
        info["erro"] = repr(e)
    finally:
        (SAIDA / f"{rotulo}_rede.json").write_text(
            json.dumps(rede, ensure_ascii=False, indent=1), encoding="utf-8")
        info["chamadas_xhr"] = sum(1 for r in rede if r["tipo"] in {"xhr", "fetch"})
        contexto.close()
    return info


# ------------------------------------------------------------------ main
def veredito(item: dict) -> str:
    if item.get("erro"):
        return "ERRO " + item["erro"][:120]
    a = item.get("analise") or {}
    if item.get("status") != 200:
        return f"HTTP {item.get('status')}"
    if a.get("bloqueio_detectado"):
        return "BLOQUEADO? (" + ", ".join(a["bloqueio_detectado"]) + ")"
    return (f"OK — {a.get('qtd_precos_em_texto', 0)} preços, "
            f"{a.get('qtd_ancoras_carta', 0)} âncoras, "
            f"{len(a.get('variaveis_js', []))} variáveis JS")


def main() -> None:
    SAIDA.mkdir(exist_ok=True)
    args = sys.argv[1:]
    alvos = {
        "edicoes": URL_EDICOES,
        "edicao": args[0] if len(args) > 0 else URL_EDICAO,
        "carta": args[1] if len(args) > 1 else URL_CARTA,
    }
    resumo = {
        "quando": time.strftime("%Y-%m-%d %H:%M:%S"),
        "onde": "github-actions" if os.environ.get("GITHUB_ACTIONS") else "local",
        "alvos": alvos, "resultados": [],
    }

    sessao = requests.Session()
    for rotulo, url in alvos.items():
        r = via_requests(rotulo, url, sessao)
        r["rotulo"] = rotulo
        resumo["resultados"].append(r)
        time.sleep(4)

    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            navegador = p.chromium.launch(headless=True)
            for rotulo, url in alvos.items():
                r = via_playwright(rotulo, url, navegador)
                r["rotulo"] = rotulo
                resumo["resultados"].append(r)
                time.sleep(4)
            navegador.close()
    except ImportError:
        resumo["playwright"] = "não instalado — só o método A foi testado"

    (SAIDA / "resumo.json").write_text(
        json.dumps(resumo, ensure_ascii=False, indent=1), encoding="utf-8")

    linhas = [f"DIAGNÓSTICO LIGA — {resumo['quando']} — {resumo['onde']}", ""]
    for r in resumo["resultados"]:
        linhas.append(f"[{r['metodo']:10}] {r['rotulo']:8} -> {veredito(r)}")
    texto = "\n".join(linhas)
    (SAIDA / "resumo.txt").write_text(texto, encoding="utf-8")
    print(texto)
    print(f"\nArquivos em: {SAIDA.resolve()}")


if __name__ == "__main__":
    main()
