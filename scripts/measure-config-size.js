/**
 * Mede o tamanho de um config salvo (JSON com data em base64 + _compressed).
 * Uso: node scripts/measure-config-size.js < arquivo.json
 * Ou: node scripts/measure-config-size.js (lê de config-sample.json)
 */
const fs = require("fs");
const zlib = require("zlib");

function measure(jsonStr) {
  const raw = jsonStr.trim();
  const totalChars = raw.length;
  const totalBytesUtf8 = Buffer.byteLength(raw, "utf8");

  let dataLen = 0;
  let compressedBytes = 0;
  let uncompressedBytes = null;
  let err = null;

  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.data === "string") {
      dataLen = obj.data.length;
      const compressed = Buffer.from(obj.data, "base64");
      compressedBytes = compressed.length;
      if (obj._compressed) {
        uncompressedBytes = zlib.gunzipSync(compressed).length;
      }
    }
  } catch (e) {
    err = e.message;
  }

  const overhead = totalChars - dataLen - (dataLen ? 2 : 0); // quotes around data
  const overheadBytes = totalBytesUtf8 - (dataLen ? Buffer.byteLength(JSON.parse(raw).data, "utf8") : 0);

  console.log("--- Tamanho do config (JSON armazenado) ---");
  console.log("Total (string):     ", totalChars.toLocaleString(), "caracteres");
  console.log("Total (UTF-8):      ", totalBytesUtf8.toLocaleString(), "bytes");
  console.log("Campo 'data' (b64): ", dataLen.toLocaleString(), "caracteres");
  console.log("Dados compactados:  ", compressedBytes.toLocaleString(), "bytes (gzip)");
  if (uncompressedBytes != null) {
    console.log("Dados descompactados:", uncompressedBytes.toLocaleString(), "bytes");
    console.log("Taxa de compressão: ", ((1 - compressedBytes / uncompressedBytes) * 100).toFixed(1) + "%");
  }
  if (err) console.log("Erro ao parsear/descompactar:", err);
}

const input = process.argv[2]
  ? fs.readFileSync(process.argv[2], "utf8")
  : (function () {
      try {
        return fs.readFileSync("/dev/stdin", "utf8");
      } catch {
        return null;
      }
    })();

if (input) {
  measure(input);
} else {
  console.log("Uso: node scripts/measure-config-size.js < arquivo.json");
  console.log("  ou: node scripts/measure-config-size.js arquivo.json");
}
