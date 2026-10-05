// Regenera src/app/core/domain/oui-device-kinds.generated.ts a partir del
// registro de fabricantes (OUI) de la IEEE, vía el espejo que publica Wireshark.
// Uso: node scripts/generate-oui-table.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MANUF_URL = 'https://www.wireshark.org/download/automated/data/manuf';
const TARGET_FILE = fileURLToPath(new URL('../src/app/core/domain/oui-device-kinds.generated.ts', import.meta.url));

// Solo fabricantes cuyos prefijos corresponden casi siempre a un mismo tipo de
// equipo. Marcas que fabrican de todo (Apple, Samsung, Xiaomi, Huawei, HP,
// Foxconn...) quedan fuera a propósito: su MAC no dice si es PC o celular.
const COMPUTER_VENDORS = [
  /^Intel Corporate$/, // tarjetas WiFi/Ethernet de laptops y PCs
  /^Compal Information/, // fabricante de laptops (ODM)
  /^Wistron/, // fabricante de laptops (ODM)
  /^Quanta Computer/, // fabricante de laptops (ODM)
  /^Pegatron/, // fabricante de laptops (ODM)
  /^AzureWave/, // módulos WiFi de laptops
  /^Liteon/, // módulos WiFi de laptops
  /^Dell Inc\.$/,
  /^Lenovo( \(Beijing\)|\(Beijing\)| Information Products|$)/,
  /^Micro-Star/, // MSI
  /^Giga-Byte/,
  /^Acer (Inc|Incorporated|Computer)/,
];
const PHONE_VENDORS = [
  /^Guangdong Oppo/,
  /^vivo Mobile/,
  /^OnePlus/,
  /^Realme/,
  /^Motorola Mobility/,
  /^HMD Global/, // Nokia
  /^Honor Device/,
  /^Nothing Technology/,
  /^Lenovo Mobile Communication/,
];

const manuf = await (await fetch(MANUF_URL)).text();
const computer = new Set();
const phone = new Set();
for (const line of manuf.split('\n')) {
  if (line.startsWith('#') || !line.trim()) continue;
  const [prefix, , vendor = ''] = line.split('\t').map((column) => column.trim());
  // Solo bloques de 24 bits (AA:BB:CC); los sub-bloques /28 y /36 no aplican.
  if (prefix.length !== 8) continue;
  const oui = prefix.replaceAll(':', '').toUpperCase();
  if (COMPUTER_VENDORS.some((pattern) => pattern.test(vendor))) computer.add(oui);
  else if (PHONE_VENDORS.some((pattern) => pattern.test(vendor))) phone.add(oui);
}

const asList = (set) => [...set].sort().map((oui) => `'${oui}'`).join(',');
writeFileSync(
  TARGET_FILE,
  `// ARCHIVO GENERADO por scripts/generate-oui-table.mjs; no editar a mano.\n` +
    `export const COMPUTER_OUIS: ReadonlySet<string> = new Set([${asList(computer)}]);\n` +
    `export const PHONE_OUIS: ReadonlySet<string> = new Set([${asList(phone)}]);\n`,
);
console.log(`[oui] ${computer.size} prefijos de computador, ${phone.size} de celular`);
