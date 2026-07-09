# Financial PWA — Gestor de Finanzas Personales

Aplicación web progresiva (PWA) offline-first para el seguimiento de gastos, deudas y tarjetas de crédito. Construida con React, TypeScript, Vite y Dexie (IndexedDB).

## Funcionalidades

- **Registro de Gastos**: Agrega, edita y elimina gastos con soporte multimoneda (conversión automática vía API de tipo de cambio).
- **Tarjetas de Crédito**: Administra múltiples tarjetas con límite de crédito, día de corte y gestión de efectivo.
- **Categorías**: Organiza tus gastos en categorías personalizables con opción de renombrar y reasignar.
- **Dashboard de Deudas**: Registra compras a meses sin intereses (MSI) con seguimiento de pagos, saldo restante y progreso visual.
- **Gráficas Interactivas**: Visualiza tus gastos por categoría en gráficos de barras, pastel o dona (SVG sin dependencias externas).
- **Sincronización con Dropbox**: Backup y restauración de datos mediante OAuth PKCE + API de Dropbox. Los datos se sincronizan en segundo plano con resolución de conflictos por timestamp.
- **Offline-First**: Todos los datos se almacenan localmente en IndexedDB mediante Dexie. La sincronización es opcional.
- **Exportación**: Exporta tus gastos a CSV o PDF.
- **Internacionalización**: Soporte para español e inglés con detección automática del idioma del navegador.
- **PWA**: Instalable como aplicación nativa con service worker y caché offline.

## Arquitectura

```
src/
├── components/       # Componentes UI atómicos
│   ├── ExpenseForm.tsx
│   ├── ExpenseChart.tsx
│   ├── CardManager.tsx
│   ├── CategoryManager.tsx
│   ├── DebtDashboard.tsx
│   └── SyncButton.tsx
├── db/               # Esquema y configuración de Dexie (IndexedDB)
│   └── schema.ts
├── hooks/            # Custom hooks
│   ├── useTranslation.ts
│   ├── useDebtCalculator.ts
│   └── ...
├── utils/            # Utilidades
│   ├── cryptoUtils.ts    # Cifrado AES-GCM (local antes de enviar a Dropbox)
│   ├── syncUtils.ts      # Normalización/desnormalización para sync
│   └── periodUtils.ts    # Cálculo de periodos por día de corte
└── locales/          # Traducciones (en.json, es.json)
```

## Stack Tecnológico

| Tecnología            | Propósito                        |
| --------------------- | -------------------------------- |
| React 19 + TypeScript | UI y tipado estricto             |
| Vite 8                | Bundler y dev server             |
| Dexie.js              | Base de datos IndexedDB          |
| Tailwind CSS 4        | Estilos utilitarios              |
| Recharts              | Gráficas (barras)                |
| Phosphor Icons        | Iconografía                      |
| Dropbox API           | Sincronización en la nube        |
| Vitest + RTL          | Tests unitarios y de integración |

## Scripts

```bash
npm run dev          # Iniciar servidor de desarrollo
npm run build        # Compilar para producción
npm run preview      # Vista previa de build
npm run lint         # ESLint
npm test             # Ejecutar tests (Vitest)
npm run test:watch   # Tests en modo watch
```

## Tests

31 tests unitarios cubriendo los 6 componentes principales con Vitest y React Testing Library, enfocados en interacciones de usuario y estados de UI.

```bash
npm test
```
