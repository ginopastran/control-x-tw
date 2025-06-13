const { readCSV, cleanAccountData } = require("./upload-accounts-from-csv.js");
const path = require("path");

async function testCSV() {
  try {
    const csvPath = path.join(
      __dirname,
      "..",
      "frontend",
      "Copia de direcciones_gmail_extendidas.xlsx - Sheet1.csv"
    );
    console.log("📁 Buscando CSV en:", csvPath);

    const records = readCSV(csvPath);
    console.log("✅ CSV leído correctamente");
    console.log("📊 Total de registros:", records.length);

    if (records.length > 0) {
      console.log("📋 Columnas disponibles:", Object.keys(records[0]));

      // Procesar los primeros 3 registros como ejemplo
      console.log("\n🔍 Procesando primeros 3 registros...");

      let validCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < Math.min(3, records.length); i++) {
        const record = records[i];
        const accountData = cleanAccountData(record);

        if (accountData) {
          validCount++;
          console.log(`\n✅ Registro ${i + 1}:`);
          console.log(`   Username: @${accountData.username}`);
          console.log(`   Email: ${accountData.email}`);
          console.log(
            `   Credenciales: OAuth1=${accountData.hasOAuth1}, OAuth2=${accountData.hasOAuth2}`
          );
          console.log(`   Etiquetas: ${accountData.labels.join(", ")}`);
        } else {
          skippedCount++;
          console.log(
            `\n⚠️ Registro ${
              i + 1
            } saltado (sin username válido o cuenta X no creada)`
          );
        }
      }

      console.log(`\n📈 Resumen de primeros 3 registros:`);
      console.log(`   ✅ Válidos: ${validCount}`);
      console.log(`   ⚠️ Saltados: ${skippedCount}`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testCSV();
