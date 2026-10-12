# Guía de uso de MUSTER

[English version](USAGE_GUIDE.md).

Guía práctica para jueces, personas que quieran probar la aplicación y quien grabe la demo. La [aplicación](https://muster-dapp.vercel.app) opera en Monad testnet.

## 1. Explorar los ejemplos sin wallet

1. Abrí la [aplicación](https://muster-dapp.vercel.app). El indicador superior dice **Monad testnet**; no hace falta instalar una extensión de wallet.
2. En **Market (L1)**, tocá **Refresh** bajo “Recent positions” y elegí **#0**. También podés escribir `0` en “Position ID” y tocar **Load**.
3. La posición debe mostrar **Defaulted** y los datos registrados en la cadena. Abrí el [reporte CRE en Monad Explorer](https://testnet.monadexplorer.com/tx/0xf6dc7a5cd0527b52007ac9907070edd00f9f75287f4fdf245ede2a0361300303) para ver la transacción que activó el default.
4. En **Reputation**, pegá `0xAD35Bed0058774F00Ca44884806a018Db5a51787` para consultar las estadísticas públicas del proveedor de demo. No necesitás wallet ni fondos.
5. **Pool (L2)** permite consultar una clase ingresando su `classId` de 32 bytes. Si no tenés uno, usá Market y Reputation: esos recorridos tienen ejemplos públicos concretos.

## 2. Completar un ciclo con transacciones de testnet

El MON de testnet no es dinero real, pero las transacciones quedan registradas en la cadena y el gas gastado no se recupera. Una sola cuenta puede actuar como proveedor y comprador para probar la interfaz; esto no demuestra una operación entre contrapartes independientes. Para mostrar dos partes separadas, usá dos cuentas de testnet y cambiá la passkey al cambiar de rol.

1. Tocá **Register new passkey** y completá el diálogo del dispositivo.
2. Copiá la dirección que aparece arriba y pedí MON de prueba en el [faucet de Monad](https://faucet.monad.xyz). Esperá a que llegue. Usá una cuenta de demo; no ingreses claves privadas ni uses fondos de mainnet.
3. En **List new capacity**, completá:
   - Dominio: `DEMO_SECURITY_RESPONSE`
   - Cantidad: `1`
   - Inicio: unos minutos antes de ahora
   - Vencimiento: al menos una hora después de ahora
   - SLA: `300` segundos
   - Ventana de disputa: `300` segundos
   - Panel vacío y threshold `0`
4. Indicá un precio y un colateral pequeños, mayores que cero y acordes al saldo de prueba. Publicar bloquea el colateral en el contrato. Tocá **List capacity** y confirmá.
5. En “Recent positions”, abrí la posición recién creada. Tocá **Reserve (pay price)** y confirmá el pago; después tocá **Activate**.
6. Como la misma cuenta publicó la oferta, también puede tocar **Accept activation (provider)** y **Claim delivery (provider)**. En la descripción de evidencia, escribí `demo delivery`; la aplicación calcula un hash antes de enviar la transacción.
7. Tocá **Settle (buyer approves)**. La posición debería quedar **Settled**. Si una cuenta hizo ambos roles, el contrato devuelve el precio y el colateral a esa cuenta al liquidar. El gas no se devuelve.

Este recorrido registra una afirmación de entrega y su hash, pero el contrato no verifica el trabajo fuera de la cadena. No lo presentes como evidencia de un servicio real prestado.

## 3. Recorrido corto para grabar el video

No hace falta crear una posición ni esperar un SLA para mostrar la evidencia ya existente:

1. Abrí la aplicación antes de grabar y cargá la posición **#0**.
2. Mostrá su estado **Defaulted** y abrí la transacción del reporte CRE.
3. Abrí **Reputation**, consultá la dirección del proveedor de demo y mostrá los contadores.
4. Cerrá con la idea del producto y el enlace a la aplicación.

Si también querés mostrar transacciones, registrá y fondeá una passkey de testnet antes de grabar; no dependas del faucet durante la toma.
