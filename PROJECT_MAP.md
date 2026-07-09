# Project Map

## Key Directories

- `/src/components`: UI Atomic components.
- `/src/hooks`: Custom hooks (useDropboxSync, useEncryption, useFinanceState).
- `/src/types`: TypeScript interfaces for financial data.
- `/src/services`: Dropbox API integration and service layer.
- `/src/utils`: Encryption (AES-GCM), data formatting, and helpers.

## Data Schema (JSON Context)

- Every transaction object follows: `{ id: string, date: string, amount: number, category: string, description: string, encrypted: boolean }`

## Workflow Strategy

1. CONSULT this map FIRST.
2. If file content is needed, READ ONLY the relevant file.
3. Apply changes and finalize in one sequence after plan approval.
