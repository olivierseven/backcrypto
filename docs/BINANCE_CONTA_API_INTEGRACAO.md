# Integração futura: conta Binance (API keys)

Este ficheiro guarda **copy e requisitos legais/UX** para quando for implementada a ligação da conta Binance do utilizador (API keys).

## Texto de consentimento (UI) — Português (PT)

Use este texto no fluxo de “conectar Binance” (checkbox, modal ou página de autorização), antes de guardar as chaves.

> Ao conectar sua conta da Binance, você autoriza a SevenCoins a armazenar suas chaves de API de forma criptografada e a utilizá-las exclusivamente para executar ordens e consultar dados de mercado conforme suas configurações. Você pode revogar esse acesso a qualquer momento.

## Same copy — English (EN)

Use the same meaning in the English UI (aligned with `en` / `pt` in translations when implemented).

> By connecting your Binance account, you authorize SevenCoins to store your API keys in encrypted form and to use them solely to execute orders and query market data according to your settings. You may revoke this access at any time.

## Notas para implementação

- Persistir chaves **apenas criptografadas** (nunca em plaintext em logs ou BD).
- Escopos/permissões da API na Binance devem refletir o mínimo necessário (ordens + leitura de mercado conforme o produto).
- Oferecer **revogação** (eliminar chaves / desligar integração) na UI e invalidar tokens no backend.
- Ao adicionar à app, colocar as strings em `src/app/lib/translations.ts` (ou módulo equivalente), chaves `en` e `pt` alinhadas.
