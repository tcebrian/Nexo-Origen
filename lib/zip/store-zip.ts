/**
 * Generador mínimo de ZIP sin compresión ("store"), pensado para el navegador.
 *
 * Se usa para empaquetar imágenes PNG, que ya vienen comprimidas: comprimirlas
 * otra vez no ahorra casi nada y obligaría a añadir una dependencia. Formato
 * ZIP estándar (sin ZIP64: hasta 65.535 archivos y 4 GB), nombres en UTF-8.
 */

export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Fecha/hora en el formato DOS que exige el ZIP (resolución de 2 s, desde 1980). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function createStoredZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  if (entries.length === 0) throw new Error("No hay archivos que comprimir.");
  if (entries.length > 0xffff) throw new Error("Demasiados archivos para un ZIP simple.");

  const encoder = new TextEncoder();
  const stamp = dosDateTime(now);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    if (size > 0xffffffff || offset > 0xffffffff) throw new Error("ZIP demasiado grande.");

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // firma cabecera local
    local.setUint16(4, 20, true); // versión mínima
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // método 0 = sin compresión
    local.setUint16(10, stamp.time, true);
    local.setUint16(12, stamp.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true); // sin campo extra

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); // firma directorio central
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, stamp.time, true);
    dir.setUint16(14, stamp.date, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, size, true);
    dir.setUint32(24, size, true);
    dir.setUint16(28, name.length, true);
    dir.setUint16(30, 0, true); // extra
    dir.setUint16(32, 0, true); // comentario
    dir.setUint16(34, 0, true); // disco
    dir.setUint16(36, 0, true); // atributos internos
    dir.setUint32(38, 0, true); // atributos externos
    dir.setUint32(42, offset, true); // posición de la cabecera local

    parts.push(new Uint8Array(local.buffer), name, entry.data);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // firma fin de directorio central
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);

  const chunks = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}
