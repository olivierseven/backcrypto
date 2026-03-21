# Itens não alterados na troca backcrypto → crypto (URLs)

Quando o prefixo das URLs foi alterado de `/backcrypto` para `/crypto`, estes pontos foram **mantidos de propósito** para avaliar depois:

1. **Schema do banco e SQL**  
   - Uso de `backcrypto."..."` (schema PostgreSQL, tabelas, etc.).

2. **Chaves de localStorage**  
   - `backcrypto-klines-*`  
   - `backcrypto:spot_extremes:*`  
   - (e demais chaves com prefixo `backcrypto`)

3. **Eventos customizados**  
   - `backcrypto-drawings-updated`  
   - `backcrypto-drawings-cleared`  
   - `backcrypto-drawings-edit`  
   - (e demais eventos com prefixo `backcrypto`)

4. **Prisma / client gerado**  
   - Referências ao schema e paths em código gerado (ex.: `prisma-bio-client`).

---

*Documento criado para decisão futura: migrar ou não esses identificadores para algo alinhado a "crypto".*
