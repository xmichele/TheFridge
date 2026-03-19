# Archivio originale

L archivio UI usa due livelli di dati:

- `public/support/original-recipes-support.json`
  indice leggero per lista, filtri e paginazione
- `public/support/original-recipes-details/*.json`
  dettaglio completo caricato solo quando apri una ricetta

Questo serve a tenere la pagina archivio piu fluida, soprattutto su mobile.

# Cambi recenti

- rimosso il vecchio limite di `3` ricette per ingrediente principale
- archivio portato a `23.844` ricette strutturate da `27.000` record sorgente
- aggiunta paginazione con scelta `12 / 24 / 48` ricette per pagina
- aggiunti i filtri profilo:
  `main-dish`, `carne`, `pesce`, `primo`, `antipasto`, `zuppe`, `vegetariano`, `vegano`, `gluten-free`, `lactose-free`
- popup ricetta e pagina dettaglio ora caricano il contenuto completo on demand
- quick description ripulita da informazioni gia mostrate come badge
- ingrediente principale evidenziato in verde e grassetto nella lista ingredienti
- cache PWA alleggerita:
  i grossi file archivio non vengono precacheati

# File toccati

- `scripts/generate-original-recipe-support.mjs`
- `src/data/services/originalRecipeSupportService.ts`
- `src/domain/support.ts`
- `src/pages/OriginalArchivePage.tsx`
- `src/pages/OriginalArchiveRecipePage.tsx`
- `src/components/ui/OriginalRecipeInfoModal.tsx`
- `src/styles/global.css`
