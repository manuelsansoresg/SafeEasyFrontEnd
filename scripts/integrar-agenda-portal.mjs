import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const target = path.join(
  projectRoot,
  "src",
  "app",
  "empresas",
  "[slug]",
  "page.tsx",
);

if (!fs.existsSync(target)) {
  console.error(`No encontré el archivo:\n${target}`);
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");

const importLine =
  'import { AgendaBookingButton } from "@/components/agenda/AgendaBookingButton";';

if (!source.includes(importLine)) {
  const anchor =
    'import { DirectoryGallerySection } from "@/components/supplier/DirectoryGallerySection";';

  if (!source.includes(anchor)) {
    console.error(
      "No encontré el import de DirectoryGallerySection. El archivo cambió y no quiero modificarlo a ciegas.",
    );
    process.exit(1);
  }

  source = source.replace(
    anchor,
    `${anchor}\n${importLine}`,
  );
}

const componentCode = `                      <AgendaBookingButton
                        supplierId={supplier.id}
                        className="w-full sm:w-auto"
                      />
`;

if (!source.includes("<AgendaBookingButton")) {
  const anchor = `                      {isDirectory ? (
                        <DirectoryContactButton
                          supplierId={supplier.id}`;

  if (!source.includes(anchor)) {
    console.error(
      "No encontré el bloque del hero donde debe insertarse Agenda. El archivo cambió y no quiero modificarlo a ciegas.",
    );
    process.exit(1);
  }

  source = source.replace(
    anchor,
    `${componentCode}${anchor}`,
  );
}

const backup = `${target}.bak`;

if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup);
}

fs.writeFileSync(target, source, "utf8");

console.log("Agenda integrada correctamente en la página pública.");
console.log(`Archivo actualizado: ${target}`);
console.log(`Respaldo: ${backup}`);
console.log("");
console.log("Ahora ejecuta:");
console.log("npm run build");
