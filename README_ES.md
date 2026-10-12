<p align="center"><a href="README.md"><strong>English</strong></a> · <a href="README_ES.md"><strong>Español</strong></a> · <a href="docs/TECHNICAL_README.md"><strong>Technical README</strong></a> (arquitectura, invariantes y evidencia)<br><a href="https://muster-dapp.vercel.app"><strong>→ Aplicación en vivo</strong></a> · <a href="docs/USAGE_GUIDE.md">Guía en inglés para jueces</a> · <a href="docs/GUIA_DE_USO_ES.md">Guía en español para revisión</a> · <a href="https://muster-pitch.vercel.app"><strong>Página de presentación</strong></a> · <a href="docs/BUSINESS_CASE.md">Caso de negocio</a></p>

# MUSTER

Conseguir ayuda especializada durante un incidente de seguridad puede ser difícil justo cuando más se necesita. Contratar a alguien a tiempo completo o pagar un abono mensual resulta costoso si la capacidad queda sin usar; buscar ayuda cuando el incidente ya empezó deja al comprador negociando bajo presión.

**MUSTER permite reservar esa capacidad por adelantado, sin convertirla en una suscripción.** El proveedor compromete disponibilidad y deja una garantía como colateral. El comprador puede transferir la reserva si ya no la necesita o activarla cuando surge el incidente.

## Probalo

- **Aplicación web:** [muster-dapp.vercel.app](https://muster-dapp.vercel.app)
- **Presentación:** [muster-pitch.vercel.app](https://muster-pitch.vercel.app)
- **Red:** Monad testnet (chain ID 10143)
- **Código fuente:** [GitHub](https://github.com/annatchijova/muster)

La aplicación permite consultar los contratos sin conectar una wallet. Para enviar transacciones, registrá una passkey desde un navegador compatible; Mera deriva una cuenta para firmar. La cuenta necesita MON de testnet, disponible en el [faucet de Monad](https://faucet.monad.xyz).

La posición #0 es un ejemplo público: se listó, reservó y activó con un SLA de 45 segundos; Chainlink CRE detectó el vencimiento y ejecutó el default. [Ver en el explorer la transacción del reporte CRE](https://testnet.monadexplorer.com/tx/0xf6dc7a5cd0527b52007ac9907070edd00f9f75287f4fdf245ede2a0361300303). La posición quedó en estado Defaulted y el contador de defaults del proveedor puede consultarse en el contrato.

## Qué hace

Un proveedor publica, por ejemplo: *«4 unidades de respuesta a incidentes de seguridad ZK, disponibles durante octubre; acepto la activación en un máximo de 30 minutos»*. La oferta se convierte en una posición onchain con dueño, ventana de disponibilidad, precio, plazo de respuesta y colateral.

El comprador reserva la posición. Si no ocurre ningún incidente, puede transferir la reserva a otra empresa antes del vencimiento. Si necesita el servicio, la activa y empieza a correr el SLA. Si el proveedor no acepta a tiempo, el contrato permite reclamar el colateral según las reglas publicadas.

```text
PUBLICAR → RESERVAR ──┬─ no ocurre el incidente → transferir la reserva
                      └─ ocurre el incidente    → activar → empieza el SLA
```

| En un acuerdo informal | En MUSTER |
|---|---|
| La disponibilidad podría prometerse a más de un cliente | Cada posición solo se puede reservar una vez |
| Un SLA incumplido puede acabar en una disputa difícil de resolver | El colateral respalda las condiciones y el contrato contempla el default |
| Una reserva sin uso puede ser un costo hundido | La reserva se puede transferir antes del vencimiento |
| Durante un incidente se negocia bajo presión | Precio y proveedor quedan fijados al reservar |

## Cómo funciona

Una posición individual recorre este ciclo:

```text
LISTED → RESERVED → ACTIVATED → ACCEPTED → DELIVERY CLAIMED → SETTLED
            │            │                         │
            │            └─ vence el SLA → DEFAULTED
            └─ vence sin activarse → EXPIRED
```

Antes de cobrar, el proveedor registra una afirmación de entrega con un hash de la evidencia. El comprador puede aceptarla o disputar la entrega dentro de una ventana limitada. Hay rutas de timeout para que el silencio de cualquiera de las partes no bloquee fondos indefinidamente. El arbitraje por panel es opcional; el contrato no garantiza que sus integrantes sean independientes. El [README técnico](docs/TECHNICAL_README.md) describe las reglas de pago, invariantes y límites de confianza.

## Contratos e integraciones

**CapacityMarket** gestiona posiciones de un proveedor. **CapacityPool** agrupa capacidad fungible bajo una misma clase de condiciones: el comprador reserva una cantidad sin elegir proveedor y la activación la asigna en orden FIFO. Cada parte asignada tiene su propio ciclo de aceptación, entrega, disputa y liquidación; el default de un proveedor no cancela las asignaciones de los demás.

- **Chainlink CRE:** un workflow programado busca plazos vencidos y envía un reporte a un dispatcher cerrado que solo permite seis acciones conocidas sobre los dos contratos. El default de la posición de ejemplo se ejecutó mediante este flujo.
- **Envio HyperIndex:** indexa los eventos de ambos contratos y las estadísticas de proveedores para consultarlas por GraphQL.
- **Mera:** permite firmar desde la aplicación usando una passkey, sin extensión de wallet ni frase semilla.
- Las estadísticas de resultados por proveedor son informativas y no alteran el orden FIFO.

## Implementación y evidencia

Solidity y Foundry para los contratos; TypeScript para la aplicación web y el workflow CRE; Vite para compilar la aplicación, desplegada en Vercel; Monad testnet para los contratos y la demo.

El proyecto documenta 118 pruebas Solidity y 5 pruebas del workflow CRE. Cubren los ciclos e invariantes descritos en sus suites; no constituyen una prueba de corrección general. La auditoría adversarial de los niveles 4/5 y CRE está en [docs/SECURITY_AUDIT_ROUND2_2026-10-05.md](docs/SECURITY_AUDIT_ROUND2_2026-10-05.md).

### Contratos actuales en Monad testnet

| Contrato | Dirección |
|---|---|
| CapacityMarket | [0xb2bEed70CA03F9ae86276f14aAB79F6F36f681C3](https://testnet.monadexplorer.com/address/0xb2bEed70CA03F9ae86276f14aAB79F6F36f681C3) |
| CapacityPool | [0xA5460952b9445C2CC5daf08D4808C09f4458Aa11](https://testnet.monadexplorer.com/address/0xA5460952b9445C2CC5daf08D4808C09f4458Aa11) |
| CRE Deadline Receiver de producción | [0x7B9d3D1e58AFca458226235Ab2366B4BF36407dD](https://testnet.monadexplorer.com/address/0x7B9d3D1e58AFca458226235Ab2366B4BF36407dD) |

Los contratos actuales se desplegaron el 5 de octubre de 2026 y se verificaron en Sourcify. La posición #0 se ejercitó contra ese despliegue el 9 de octubre. Las direcciones históricas y sus diferencias están documentadas en el [README técnico](docs/TECHNICAL_README.md); no las uses para nuevas operaciones.

## Ejecutar localmente

Requisitos: Foundry para los contratos y Bun para la aplicación web.

```bash
forge build
forge test

cd web
bun install
bun run build
bun run dev
```

Para desplegar contratos propios en Monad testnet, seguí las instrucciones de [README.md](README.md#deploying-to-monad-testnet) y usá una cuenta financiada con MON de prueba. No compartas ni subas claves privadas.

## Estructura del repositorio

```text
src/                         Contratos Solidity
test/                        Pruebas Foundry
muster-cre/deadline-keeper/  Workflow CRE y pruebas TypeScript
web/                         Aplicación Vite + TypeScript
envio/                       Indexador HyperIndex
pitch/                       Página de presentación
docs/                        Arquitectura, negocio y auditorías
```

## Alcance y próximos pasos

MUSTER se construyó para el track **Onchain Finance & Trading** del hackathon Monad Metropolis. La capacidad futura puede aplicarse a respuesta a incidentes, pentesting u otros servicios especializados que puedan describirse con una clase de condiciones.

El panel de arbitraje usa direcciones elegidas al publicar la oferta; no incluye staking, slashing ni garantía de independencia. La reputación se registra, pero todavía no modifica el enrutamiento FIFO. El [README técnico](docs/TECHNICAL_README.md) detalla estas decisiones y sus límites; el [caso de negocio](docs/BUSINESS_CASE.md) describe la hipótesis de piloto y los próximos pasos.

## Licencia

Apache-2.0. Consultá [LICENSE](LICENSE).
