import { database } from '@/db/raw';
export async function GET() {
  try {
    const db = database();
    const result = await db.batch(
      ['products', 'branches', 'suppliers', 'stock', 'movements'].map((t) =>
        db.prepare(
          `SELECT * FROM ${t}${t === 'movements' ? ' ORDER BY created DESC' : ''}`,
        ),
      ),
    );
    return Response.json(
      Object.fromEntries(
        ['products', 'branches', 'suppliers', 'stock', 'movements'].map(
          (t, i) => [t, result[i].results],
        ),
      ),
    );
  } catch {
    return Response.json(
      { error: 'No se pudo cargar el inventario. Intenta de nuevo.' },
      { status: 503 },
    );
  }
}
const text = (x: unknown, max = 180) => {
  if (typeof x !== 'string' || !x.trim() || x.length > max)
    throw Error('Completa los campos obligatorios.');
  return x.trim();
};
const num = (x: unknown, integer = false) => {
  const n = Number(x);
  if (
    x === '' ||
    x === null ||
    !Number.isFinite(n) ||
    n < 0 ||
    n > 1e9 ||
    (integer && !Number.isInteger(n))
  )
    throw Error('Introduce una cantidad válida, sin valores negativos.');
  return n;
};
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return Response.json({ error: 'Origen no permitido' }, { status: 403 });
    const b = (await req.json()) as Record<string, any>;
    const db = database();
    let id = crypto.randomUUID();
    if (b.action === 'product') {
      const values = [
        text(b.name),
        text(b.sku, 80),
        String(b.barcode || '').slice(0, 80),
        text(b.category),
        text(b.unit),
        num(b.cost),
        num(b.price),
        num(b.minimum, true),
        b.supplier || null,
        String(b.expiry || '').slice(0, 10),
      ];
      if (b.id) {
        id = text(b.id);
        await db
          .prepare(
            'UPDATE products SET name=?,sku=?,barcode=?,category=?,unit=?,cost=?,price=?,minimum=?,supplier=?,expiry=? WHERE id=?',
          )
          .bind(...values, id)
          .run();
      } else
        await db
          .prepare(
            'INSERT INTO products (id,name,sku,barcode,category,unit,cost,price,minimum,supplier,expiry) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(id, ...values)
          .run();
    } else if (b.action === 'branch') {
      if (b.id) {
        id = text(b.id);
        await db
          .prepare('UPDATE branches SET name=?,city=?,kind=? WHERE id=?')
          .bind(text(b.name), text(b.city), text(b.kind), id)
          .run();
      } else
        await db
          .prepare('INSERT INTO branches (id,name,city,kind) VALUES (?,?,?,?)')
          .bind(id, text(b.name), text(b.city), text(b.kind))
          .run();
    } else if (b.action === 'supplier') {
      if (b.id) {
        id = text(b.id);
        await db
          .prepare('UPDATE suppliers SET name=?,email=?,phone=? WHERE id=?')
          .bind(
            text(b.name),
            String(b.email || '').slice(0, 180),
            String(b.phone || '').slice(0, 80),
            id,
          )
          .run();
      } else
        await db
          .prepare(
            'INSERT INTO suppliers (id,name,email,phone) VALUES (?,?,?,?)',
          )
          .bind(
            id,
            text(b.name),
            String(b.email || '').slice(0, 180),
            String(b.phone || '').slice(0, 80),
          )
          .run();
    } else if (b.action === 'movement') {
      id = text(b.id, 80);
      const product = text(b.product),
        branch = text(b.branch),
        type = text(b.type);
      const q = num(b.quantity, true);
      const note = text(b.note, 500);
      const date = new Date().toISOString();
      if (!['Entrada', 'Salida', 'Transferencia', 'Conteo'].includes(type))
        throw Error('Tipo de movimiento inválido.');
      if (q === 0 && type !== 'Conteo')
        throw Error('La cantidad debe ser mayor que cero.');
      if (
        await db.prepare('SELECT id FROM movements WHERE id=?').bind(id).first()
      )
        return Response.json({ id });
      const destination = type === 'Transferencia' ? text(b.destination) : null;
      if (destination === branch)
        throw Error('El destino debe ser otra sucursal.');
      const statements = [
        db
          .prepare(
            'INSERT INTO stock (product,branch,quantity) VALUES (?,?,0) ON CONFLICT DO NOTHING',
          )
          .bind(product, branch),
      ];
      if (type === 'Conteo') {
        statements.push(
          db
            .prepare(
              'INSERT INTO movements (id,product,branch,destination,type,quantity,note,created) SELECT ?,product,branch,NULL,?,?-quantity,?,? FROM stock WHERE product=? AND branch=?',
            )
            .bind(id, type, q, note, date, product, branch),
        );
        statements.push(
          db
            .prepare('UPDATE stock SET quantity=? WHERE product=? AND branch=?')
            .bind(q, product, branch),
        );
      } else {
        statements.push(
          db
            .prepare(
              'INSERT INTO movements (id,product,branch,destination,type,quantity,note,created) VALUES (?,?,?,?,?,?,?,?)',
            )
            .bind(id, product, branch, destination, type, q, note, date),
        );
        statements.push(
          db
            .prepare(
              'UPDATE stock SET quantity=quantity+? WHERE product=? AND branch=?',
            )
            .bind(type === 'Entrada' ? q : -q, product, branch),
        );
        if (destination)
          statements.push(
            db
              .prepare(
                'INSERT INTO stock (product,branch,quantity) VALUES (?,?,?) ON CONFLICT(product,branch) DO UPDATE SET quantity=quantity+excluded.quantity',
              )
              .bind(product, destination, q),
          );
      }
      await db.batch(statements);
    } else if (b.action === 'demo') {
      if (await db.prepare('SELECT id FROM products LIMIT 1').first())
        throw Error('Los ejemplos solo se pueden cargar en un catálogo vacío.');
      const bs = [
        ['b1', 'Centro de distribución', 'Guayaquil', 'Almacén'],
        ['b2', 'Sucursal Norte', 'Quito', 'Tienda'],
        ['b3', 'Sucursal Centro', 'Guayaquil', 'Tienda'],
        ['b4', 'Sucursal Cuenca', 'Cuenca', 'Tienda'],
      ];
      const ps = [
        [
          'p1',
          'Café de origen 250 g',
          'ALI-001',
          'Alimentos',
          'Bolsa',
          4.8,
          8.5,
          30,
          's1',
          '2027-06-01',
        ],
        [
          'p2',
          'Camiseta esencial algodón',
          'MOD-001',
          'Moda',
          'Unidad',
          8.5,
          19.9,
          20,
          's2',
          '',
        ],
        [
          'p3',
          'Audífonos inalámbricos',
          'TEC-001',
          'Electrónica',
          'Unidad',
          24,
          49.9,
          15,
          's3',
          '',
        ],
        [
          'p4',
          'Jabón líquido 500 ml',
          'CUI-001',
          'Cuidado personal',
          'Unidad',
          2.1,
          4.5,
          25,
          's1',
          '2027-01-01',
        ],
        [
          'p5',
          'Taladro inalámbrico 20 V',
          'FER-001',
          'Ferretería',
          'Unidad',
          48,
          89.9,
          10,
          's3',
          '',
        ],
        [
          'p6',
          'Leche entera 1 L',
          'ALI-002',
          'Alimentos',
          'Unidad',
          0.85,
          1.35,
          40,
          's1',
          '2026-09-18',
        ],
        [
          'p7',
          'Zapatillas urbanas',
          'MOD-002',
          'Moda',
          'Par',
          22,
          45,
          12,
          's2',
          '',
        ],
        [
          'p8',
          'Lámpara de escritorio LED',
          'HOG-001',
          'Hogar',
          'Unidad',
          12.5,
          28,
          10,
          's3',
          '',
        ],
      ];
      const ss = [
        ['s1', 'Distribuidora Andina', 'ventas@andina.example', '04 200 0101'],
        [
          's2',
          'Textiles del Pacífico',
          'pedidos@pacifico.example',
          '02 200 0202',
        ],
        ['s3', 'Comercial Nova', 'ventas@nova.example', '07 200 0303'],
      ];
      const stmts = [
        ...bs.map((v) =>
          db
            .prepare(
              'INSERT INTO branches VALUES (?,?,?,?) ON CONFLICT DO NOTHING',
            )
            .bind(...v),
        ),
        ...ss.map((v) =>
          db
            .prepare(
              'INSERT INTO suppliers VALUES (?,?,?,?) ON CONFLICT DO NOTHING',
            )
            .bind(...v),
        ),
        ...ps.map((v) =>
          db
            .prepare(
              'INSERT INTO products (id,name,sku,category,unit,cost,price,minimum,supplier,expiry) VALUES (?,?,?,?,?,?,?,?,?,?)',
            )
            .bind(...v),
        ),
      ];
      ps.forEach((p, i) =>
        bs.forEach((b, j) => {
          const q = [
            [240, 86, 120, 64],
            [180, 52, 38, 28],
            [65, 8, 22, 16],
            [320, 72, 110, 48],
            [28, 6, 12, 9],
            [480, 24, 180, 96],
            [95, 32, 28, 0],
            [120, 36, 42, 24],
          ][i][j];
          stmts.push(
            db.prepare('INSERT INTO stock VALUES (?,?,?)').bind(p[0], b[0], q),
          );
          stmts.push(
            db
              .prepare('INSERT INTO movements VALUES (?,?,?,NULL,?,?,?,?)')
              .bind(
                crypto.randomUUID(),
                p[0],
                b[0],
                'Entrada',
                q,
                'Inventario inicial · ejemplo',
                new Date(Date.now() - (i * 4 + j) * 21600000).toISOString(),
              ),
          );
        }),
      );
      await db.batch(stmts);
    } else throw Error('Acción no válida.');
    return Response.json({ id });
  } catch (e) {
    const message = String(e);
    const error = message.includes('nonnegative_stock')
      ? 'Stock insuficiente. Revisa las existencias de la sucursal de origen.'
      : message.includes('UNIQUE')
        ? 'Ya existe un producto con ese SKU.'
        : message.includes('FOREIGN KEY')
          ? 'El producto, proveedor o sucursal no existe.'
          : message.includes('D1_')
            ? 'No se pudo guardar la operación. Vuelve a intentarlo.'
            : e instanceof Error
              ? e.message
              : 'No se pudo guardar.';
    return Response.json({ error }, { status: 400 });
  }
}
