# GeoMundo

Atlas educativo responsivo e instalável, desenvolvido somente com HTML, CSS e JavaScript.

## Recursos

- mapa vetorial interativo com GeoJSON local e seleção de 195 países;
- fichas de países e das 27 unidades federativas brasileiras;
- busca por país, capital, continente, moeda e idioma;
- comparação entre países e entre estados;
- favoritos, perfil local e temas claro/escuro;
- PWA com funcionamento offline e estratégia de cache adequada;
- caminhos relativos compatíveis com Windows, Linux, macOS e GitHub Pages.

## Executar localmente

Sirva a pasta por HTTP. Exemplo com Python:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`. O Service Worker não funciona quando o arquivo é aberto diretamente com `file://`.

## GitHub Pages

Envie o conteúdo deste repositório para a branch `main`. O workflow em `.github/workflows/pages.yml` publica o projeto automaticamente. Todos os caminhos usam `./`, portanto funcionam tanto na raiz quanto em subdiretórios de projeto.

## Estrutura principal

```text
geografia-pwa/
├── .github/workflows/pages.yml
├── assets/
│   ├── icons/
│   ├── images/
│   └── vendor/leaflet/
├── data/
│   ├── countries.json
│   ├── states.json
│   └── world.geojson
├── app.js
├── index.html
├── manifest.webmanifest
├── offline.html
├── service-worker.js
└── styles.css
```
