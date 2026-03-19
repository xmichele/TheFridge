# GitHub Pages E Archivio Originale

## Deploy

- hosting: GitHub Pages
- deploy automatico: `.github/workflows/deploy-github-pages.yml`
- branch di deploy:
  - `master` nel repo `Rubik90/TheFridge`
  - `main` nel repo `xmichele/TheFridge`
- URL atteso: `https://<user>.github.io/TheFridge/`

## Routing SPA

- router con `basename` preso da `import.meta.env.BASE_URL`
- fallback GitHub Pages in `public/404.html`
- redirect ripristinato in `src/app/githubPagesRedirect.ts`

## PWA

- manifest e shortcut usano il base path `/TheFridge/`
- i file molto grandi dell'archivio non vengono precacheati
- il service worker resta attivo per shell app e asset leggeri

## Archivio Originale

- indice principale: `public/support/original-recipes-support.json`
- lookup leggero: `public/support/original-recipes-lookup.json`
- dettagli: `public/support/original-recipes-details/*.json`
- il dettaglio ricetta e il planner usano il lookup per evitare di caricare sempre il dataset grande

## Verifiche Utili

```bash
npm run test -- githubPagesRedirect originalRecipeSupportService support ui
npm run build
```

## Nota

- localmente Node `22.2.0` mostra un warning con Vite
- nel workflow GitHub Actions viene usato Node `22.12.0`
