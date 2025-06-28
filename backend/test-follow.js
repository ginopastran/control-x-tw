// Script de prueba para verificar el flujo de follow y validaciones

// 🔥 FUNCIÓN PARA OBTENER CUENTAS REALES DEL SISTEMA
async function getRealAccounts() {
  try {
    const response = await fetch("http://localhost:3001/api/accounts");
    if (response.ok) {
      const accounts = await response.json();
      return accounts.filter((acc) => acc.isActive);
    }
  } catch (error) {
    console.error("Error obteniendo cuentas:", error.message);
  }
  return [];
}

async function testFollowValidations() {
  const baseUrl = "http://localhost:3001";

  console.log("🧪 INICIANDO TESTS DE VALIDACIONES DE FOLLOW\n");

  // Obtener cuentas reales
  console.log("🔍 Obteniendo cuentas del sistema...");
  const realAccounts = await getRealAccounts();

  if (realAccounts.length === 0) {
    console.log("❌ No se encontraron cuentas activas en el sistema");
    return;
  }

  const testAccountId = realAccounts[0].id;
  console.log(
    `✅ Usando cuenta de prueba: @${realAccounts[0].username} (${testAccountId})\n`
  );

  // Test 1: Sin targetUsername ni targetUserId (debe fallar)
  console.log("📝 Test 1: Sin target (debe fallar con error 400)");
  await testRequest(
    {
      action: "follow",
      accountIds: [testAccountId],
      baseDelay: 30000,
      randomDelay: 60000,
    },
    "FAIL"
  );

  // Test 2: targetUsername vacío (debe fallar)
  console.log("\n📝 Test 2: targetUsername vacío (debe fallar con error 400)");
  await testRequest(
    {
      action: "follow",
      accountIds: [testAccountId],
      targetUsername: "",
      baseDelay: 30000,
      randomDelay: 60000,
    },
    "FAIL"
  );

  // Test 3: targetUsername solo con @ (debe fallar)
  console.log("\n📝 Test 3: targetUsername solo @ (debe fallar con error 400)");
  await testRequest(
    {
      action: "follow",
      accountIds: [testAccountId],
      targetUsername: "@@@",
      baseDelay: 30000,
      randomDelay: 60000,
    },
    "FAIL"
  );

  // Test 4: targetUsername válido (debe pasar validaciones)
  console.log("\n📝 Test 4: targetUsername válido (debe pasar validaciones)");
  await testRequest(
    {
      action: "follow",
      accountIds: [testAccountId],
      targetUsername: "@hernanpere_z",
      baseDelay: 30000,
      randomDelay: 60000,
    },
    "PASS"
  );

  // Test 5: targetUserId como string no numérico (debe convertirse a targetUsername)
  console.log(
    "\n📝 Test 5: targetUserId como username (debe auto-convertirse)"
  );
  await testRequest(
    {
      action: "follow",
      accountIds: [testAccountId],
      targetUserId: "hernanpere_z", // Username en lugar de ID
      baseDelay: 30000,
      randomDelay: 60000,
    },
    "PASS"
  );

  // Test 6: targetUserId numérico válido
  console.log("\n📝 Test 6: targetUserId numérico (debe pasar)");
  await testRequest(
    {
      action: "follow",
      accountIds: [testAccountId],
      targetUserId: "1234567890",
      baseDelay: 30000,
      randomDelay: 60000,
    },
    "PASS"
  );

  console.log("\n✅ TESTS DE VALIDACIONES COMPLETADOS");
}

async function testRequest(testData, expectedResult) {
  try {
    console.log("📤 Enviando:", JSON.stringify(testData, null, 2));

    const response = await fetch("http://localhost:3001/api/queue/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();

    if (expectedResult === "FAIL") {
      if (!response.ok) {
        console.log(`✅ CORRECTO: Falló como esperado (${response.status})`);
        console.log(`   Error: ${result.error}`);
        if (result.details) {
          console.log(`   Detalles:`, result.details);
        }
      } else {
        console.log(`❌ INCORRECTO: Debería haber fallado pero pasó`);
        console.log(`   Respuesta:`, result);
      }
    } else {
      // PASS
      if (response.ok) {
        console.log(`✅ CORRECTO: Pasó validaciones como esperado`);
        console.log(`   Mensaje: ${result.message}`);
        console.log(`   Acciones creadas: ${result.actions?.length || 0}`);
        if (result.actions && result.actions.length > 0) {
          console.log(`   Primera acción - ID: ${result.actions[0].id}`);
        }
      } else {
        console.log(
          `❌ INCORRECTO: Debería haber pasado pero falló (${response.status})`
        );
        console.log(`   Error: ${result.error}`);
      }
    }
  } catch (error) {
    console.error("❌ Error en la petición:", error.message);
  }
}

async function testBasicFollow() {
  console.log("\n🧪 TEST BÁSICO DE FOLLOW OPTIMIZADO\n");

  // Obtener cuentas reales
  const realAccounts = await getRealAccounts();
  if (realAccounts.length === 0) {
    console.log("❌ No se encontraron cuentas para el test básico");
    return;
  }

  console.log(`✅ Cuentas disponibles: ${realAccounts.length}`);
  realAccounts.forEach((acc, i) => {
    console.log(`  ${i + 1}. @${acc.username} (ID: ${acc.id})`);
  });

  // Test 1: Follow a usuario que ESTÁ en BD local (debe ser inmediato)
  if (realAccounts.length >= 2) {
    console.log(`\n📝 Test 1: Follow entre cuentas de BD (debe ser inmediato)`);
    const sourceAccount = realAccounts[0];
    const targetAccount = realAccounts[1];

    const testData = {
      action: "follow",
      accountIds: [sourceAccount.id],
      targetUsername: targetAccount.username, // Usuario que SÍ está en BD
      baseDelay: 30000,
      randomDelay: 60000,
    };

    console.log(
      `🧪 ${sourceAccount.username} → ${targetAccount.username} (ambos en BD local)`
    );

    try {
      const response = await fetch("http://localhost:3001/api/queue/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("✅ Test BD→BD exitoso");
        console.log(`   Mensaje: ${result.message}`);
        if (result.actions && result.actions.length > 0) {
          console.log(`   Acción creada: ${result.actions[0].id}`);
          console.log(
            `   Tiempo programado: ${result.actions[0].estimatedStartTime}`
          );
        }
      } else {
        console.log("❌ Test BD→BD falló:", result.error);
      }
    } catch (error) {
      console.error("❌ Error en test BD→BD:", error.message);
    }
  }

  // Test 2: Follow a usuario que NO está en BD (debe usar API + delay 16 min)
  console.log(
    `\n📝 Test 2: Follow a usuario externo (debe usar API + delay 16min)`
  );

  const testData = {
    action: "follow",
    accountIds: [realAccounts[0].id],
    targetUsername: "hernanpere_z", // Usuario que probablemente NO está en BD
    baseDelay: 30000,
    randomDelay: 60000,
  };

  console.log(
    `🧪 ${realAccounts[0].username} → hernanpere_z (externo, requiere API)`
  );

  try {
    const response = await fetch("http://localhost:3001/api/queue/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();

    if (response.ok) {
      console.log("✅ Test API lookup exitoso");
      console.log(`   Mensaje: ${result.message}`);
      if (result.actions && result.actions.length > 0) {
        const action = result.actions[0];
        console.log(`   Acción creada: ${action.id}`);
        console.log(`   Tiempo programado: ${action.estimatedStartTime}`);

        // Verificar si se programó con delay (indicaría uso de API)
        const now = new Date();
        const scheduledTime = new Date(action.estimatedStartTime);
        const delayMinutes = Math.round((scheduledTime - now) / (1000 * 60));

        if (delayMinutes >= 15) {
          console.log(
            `   ✅ CORRECTO: Delay de ${delayMinutes} minutos aplicado (API lookup)`
          );
        } else {
          console.log(
            `   ⚠️ INESPERADO: Delay de solo ${delayMinutes} minutos`
          );
        }
      }

      // Mostrar status de la cola después de agregar
      console.log("\n🔍 Verificando estado de la cola...");
      await checkQueueStatus();
    } else {
      console.log("❌ Test API lookup falló:", result.error);
    }
  } catch (error) {
    console.error("❌ Error en test API lookup:", error.message);
  }
}

async function checkQueueStatus() {
  try {
    const response = await fetch("http://localhost:3001/api/queue/status");
    if (response.ok) {
      const status = await response.json();
      console.log("📊 Estado de la cola:", {
        enCola: status.stats?.queueLength || 0,
        ejecutándose: status.stats?.runningCount || 0,
        programadas: status.stats?.scheduled || 0,
      });

      // Mostrar detalles de acciones en cola
      if (status.queue && status.queue.length > 0) {
        console.log("📋 Acciones en cola:");
        status.queue.forEach((action, index) => {
          console.log(`  ${index + 1}. Acción ${action.action}:`);
          console.log(`     ID: ${action.id}`);
          console.log(`     Cuenta: @${action.accountUsername}`);
          console.log(
            `     Target Username: ${action.targetUsername || "N/A"}`
          );
          console.log(
            `     Target User ID: ${action.targetUserId || "❌ UNDEFINED"}`
          );
          if (action.targetUserId) {
            console.log(`     ✅ targetUserId RESUELTO correctamente`);
          } else {
            console.log(`     ❌ targetUserId NO resuelto - esto es un error`);
          }
          console.log(`     Programado: ${action.estimatedStartTime}`);
          console.log(`     Status: ${action.status}`);
        });
      }

      // Mostrar detalles de acciones programadas (scheduled)
      if (status.scheduled && status.scheduled.length > 0) {
        console.log("📅 Acciones programadas:");
        status.scheduled.forEach((action, index) => {
          console.log(`  ${index + 1}. Acción ${action.action}:`);
          console.log(`     ID: ${action.id}`);
          console.log(`     Cuenta: @${action.accountUsername}`);
          console.log(
            `     Target Username: ${action.targetUsername || "N/A"}`
          );
          console.log(
            `     Target User ID: ${action.targetUserId || "❌ UNDEFINED"}`
          );
          if (action.targetUserId) {
            console.log(`     ✅ targetUserId RESUELTO correctamente`);
          } else {
            console.log(`     ❌ targetUserId NO resuelto - esto es un error`);
          }
          console.log(`     Programado: ${action.scheduledTime}`);
          console.log(`     Status: ${action.status}`);
        });
      }

      // Mostrar detalles de acciones ejecutándose
      if (status.running && status.running.length > 0) {
        console.log("🔄 Acciones ejecutándose:");
        status.running.forEach((action, index) => {
          console.log(`  ${index + 1}. Acción ${action.action}:`);
          console.log(`     ID: ${action.id}`);
          console.log(`     Cuenta: @${action.accountUsername}`);
          console.log(
            `     Target Username: ${action.targetUsername || "N/A"}`
          );
          console.log(
            `     Target User ID: ${action.targetUserId || "❌ UNDEFINED"}`
          );
          console.log(`     Iniciado: ${action.startedAt}`);
          console.log(`     Status: ${action.status}`);
        });
      }
    }
  } catch (error) {
    console.error("Error verificando cola:", error.message);
  }
}

// Ejecutar los tests
async function runAllTests() {
  await testFollowValidations();
  await testBasicFollow();
}

runAllTests();
