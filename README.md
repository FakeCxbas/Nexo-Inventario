# Nexo · Inventario

Aplicación web en español adaptable a teléfono y PC. Catálogo con SKU, códigos de barras, categorías, costos, precios, mínimos y vencimiento de referencia; sucursales, proveedores, entradas, salidas, transferencias atómicas, conteos, alertas, reportes y exportación CSV. Usa una base D1 centralizada y el acceso privado de Sites.

## Desarrollo

`npm install` y `npm run dev`. Las migraciones de `drizzle/` deben aplicarse a la base local antes de usar la API. `npm run db:generate` genera nuevas migraciones desde `db/schema.ts`. Sites aplica las migraciones al publicar.

`npx tsc --noEmit` y `npm run build` verifican tipos y producción. `node tests/inventory.mjs` ejecuta pruebas de integración contra localhost:3000 (o INVENTORY_TEST_URL). Usar una base de pruebas: la suite crea registros.

Se comprobaron entradas, salidas, conservación en transferencias, reversión de transferencias sin stock, idempotencia, conteos, unicidad de SKU y validación de cantidades. No se realizó QA visual en navegador. La herramienta WebMCP opcional `search_inventory` se registra solo si el navegador soporta `document.modelContext`; no se dispuso de un contexto de validación WebMCP.

## Alcance

Primera versión funcional del núcleo de inventario. No es un ERP empresarial terminado: faltan permisos por empleado y organización, auditoría de identidad, órdenes de compra, reservas, lotes y series, variantes, unidades fraccionarias, integraciones POS, funcionamiento sin conexión y pruebas de carga. El vencimiento se registra por producto, no por lote. El historial de inventario se conserva y no se elimina desde la interfaz. La búsqueda por código admite entrada manual o un lector que actúe como teclado; no activa la cámara.

La publicación es privada para el propietario. No ampliar el acceso a varias organizaciones sin implementar aislamiento de datos y autorización en el servidor. La moneda actual es USD. Los datos de ejemplo se cargan expresamente mediante el botón de inicio y se identifican en pantalla.
