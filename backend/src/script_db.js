import { pool } from './keys.js';

// Función para ejecutar consultas SQL
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    console.log(`📝 Ejecutando: ${query.split(' ').slice(0, 10).join(' ')}...`);
    const result = await client.query(query, params);
    return result;
  } catch (error) {
    console.error(`❌ Error ejecutando query:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Función para insertar productos vendidos en lotes
async function insertProductosVendidos() {
  console.log("\n🛒 Insertando datos en tabla productventa...");
  
  // Dividir en lotes de 100 registros cada uno
  const batches = [
    // Lote 1 (100 registros)
    `INSERT INTO productventa (cod_producto,cod_venta,metodo_pago,precio_venta,cantidad_venta,sector,fecha_salida) VALUES
    (58,2001,'Transferencia',159.95,11.0,'Pinturas o accesorios','2025-06-14'),
	 (5,2002,'Transferencia',254.06,3.0,'Herramientas manuales','2025-06-14'),
	 (2,2003,'Efectivo',337.93,2.0,'Herramientas manuales','2025-06-14'),
	 (238,2004,'Tarjeta',71.78,2.0,'Productos de ferretería general','2025-06-14'),
	 (113,2005,'Transferencia',383.13,11.0,'Productos de ferretería general','2025-06-14'),
	 (99,2006,'Transferencia',171.51,12.0,'Seguridad industrial','2025-06-14'),
	 (105,2007,'Transferencia',374.92,8.0,'Seguridad industrial','2025-06-14'),
	 (21,2008,'Efectivo',470.32,10.0,'Herramientas eléctricas','2025-06-14'),
	 (178,2009,'Tarjeta',159.63,14.0,'Pinturas o accesorios','2025-06-14'),
	 (190,2010,'Tarjeta',394.39,19.0,'Tuberías y plomería','2025-06-14'),
   (55,2011,'Efectivo',385.38,25.0,'Pinturas o accesorios','2025-06-15'),
	 (84,2012,'Tarjeta',369.64,6.0,'Electricidad e iluminación','2025-06-15'),
	 (159,2013,'Efectivo',366.3,14.0,'Materiales de construcción','2025-06-15'),
	 (224,2014,'Transferencia',398.42,6.0,'Seguridad industrial','2025-06-15'),
	 (30,2015,'Efectivo',202.06,24.0,'Herramientas eléctricas','2025-06-15'),
	 (222,2016,'Transferencia',213.55,8.0,'Seguridad industrial','2025-06-15'),
	 (235,2017,'Transferencia',351.48,10.0,'Productos de ferretería general','2025-06-15'),
	 (38,2018,'Tarjeta',196.47,15.0,'Materiales de construcción','2025-06-15'),
	 (191,2019,'Transferencia',207.04,10.0,'Tuberías y plomería','2025-06-15'),
	 (193,2020,'Efectivo',498.33,22.0,'Tuberías y plomería','2025-06-15'),
   (143,2021,'Tarjeta',127.64,2.0,'Herramientas eléctricas','2025-06-15'),
	 (186,2022,'Efectivo',474.44,24.0,'Tuberías y plomería','2025-06-15'),
	 (166,2023,'Tarjeta',493.7,17.0,'Pinturas o accesorios','2025-06-15'),
	 (171,2024,'Transferencia',85.91,10.0,'Pinturas o accesorios','2025-06-15'),
	 (160,2025,'Tarjeta',216.31,6.0,'Materiales de construcción','2025-06-15'),
	 (236,2026,'Transferencia',12.58,25.0,'Productos de ferretería general','2025-06-16'),
	 (237,2027,'Transferencia',190.81,23.0,'Productos de ferretería general','2025-06-16'),
	 (169,2028,'Efectivo',476.19,15.0,'Pinturas o accesorios','2025-06-16'),
	 (155,2029,'Transferencia',443.98,18.0,'Materiales de construcción','2025-06-16'),
	 (136,2030,'Transferencia',299.53,13.0,'Herramientas eléctricas','2025-06-16'),
   (6,2031,'Transferencia',84.41,9.0,'Herramientas manuales','2025-06-16'),
	 (22,2032,'Efectivo',201.34,1.0,'Herramientas eléctricas','2025-06-16'),
	 (171,2033,'Efectivo',111.07,7.0,'Pinturas o accesorios','2025-06-16'),
	 (149,2034,'Tarjeta',141.21,13.0,'Herramientas eléctricas','2025-06-16'),
	 (132,2035,'Efectivo',223.42,3.0,'Herramientas manuales','2025-06-16'),
	 (188,2036,'Tarjeta',193.35,16.0,'Tuberías y plomería','2025-06-16'),
	 (216,2037,'Tarjeta',247.64,1.0,'Seguridad industrial','2025-06-16'),
	 (174,2038,'Tarjeta',412.47,22.0,'Pinturas o accesorios','2025-06-16'),
	 (10,2039,'Tarjeta',162.11,5.0,'Herramientas manuales','2025-06-16'),
	 (207,2040,'Tarjeta',377.71,3.0,'Electricidad e iluminación','2025-06-16'),
   (108,2041,'Tarjeta',89.47,10.0,'Productos de ferretería general','2025-06-17'),
	 (202,2042,'Transferencia',36.49,1.0,'Electricidad e iluminación','2025-06-17'),
	 (163,2043,'Tarjeta',452.5,21.0,'Materiales de construcción','2025-06-17'),
	 (23,2044,'Tarjeta',135.98,15.0,'Herramientas eléctricas','2025-06-17'),
	 (16,2045,'Tarjeta',456.47,8.0,'Herramientas eléctricas','2025-06-17'),
	 (93,2046,'Efectivo',73.47,15.0,'Seguridad industrial','2025-06-17'),
	 (84,2047,'Efectivo',442.15,15.0,'Electricidad e iluminación','2025-06-17'),
	 (58,2048,'Efectivo',481.55,21.0,'Pinturas o accesorios','2025-06-17'),
	 (139,2049,'Tarjeta',436.97,20.0,'Herramientas eléctricas','2025-06-17'),
	 (11,2050,'Efectivo',37.57,19.0,'Herramientas manuales','2025-06-17'),
   (48,2051,'Tarjeta',195.28,3.0,'Pinturas o accesorios','2025-06-17'),
	 (26,2052,'Efectivo',416.11,13.0,'Herramientas eléctricas','2025-06-17'),
	 (159,2053,'Efectivo',308.74,4.0,'Materiales de construcción','2025-06-17'),
	 (80,2054,'Efectivo',270.47,21.0,'Electricidad e iluminación','2025-06-17'),
	 (132,2055,'Tarjeta',105.54,2.0,'Herramientas manuales','2025-06-17'),
	 (234,2056,'Tarjeta',230.42,10.0,'Productos de ferretería general','2025-06-18'),
	 (177,2057,'Efectivo',472.29,20.0,'Pinturas o accesorios','2025-06-18'),
	 (21,2058,'Transferencia',15.58,2.0,'Herramientas eléctricas','2025-06-18'),
	 (44,2059,'Efectivo',251.09,3.0,'Materiales de construcción','2025-06-18'),
	 (51,2060,'Tarjeta',211.15,18.0,'Pinturas o accesorios','2025-06-18'),
   (189,2061,'Tarjeta',15.86,24.0,'Tuberías y plomería','2025-06-18'),
	 (186,2062,'Efectivo',122.95,13.0,'Tuberías y plomería','2025-06-18'),
	 (13,2063,'Efectivo',373.5,17.0,'Herramientas manuales','2025-06-18'),
	 (111,2064,'Transferencia',104.13,20.0,'Productos de ferretería general','2025-06-18'),
	 (10,2065,'Tarjeta',67.91,5.0,'Herramientas manuales','2025-06-18'),
	 (78,2066,'Efectivo',138.1,9.0,'Electricidad e iluminación','2025-06-18'),
	 (43,2067,'Efectivo',103.3,11.0,'Materiales de construcción','2025-06-18'),
	 (95,2068,'Tarjeta',365.53,14.0,'Seguridad industrial','2025-06-18'),
	 (220,2069,'Tarjeta',95.55,25.0,'Seguridad industrial','2025-06-18'),
	 (21,2070,'Efectivo',494.34,3.0,'Herramientas eléctricas','2025-06-18'),
   (132,2071,'Transferencia',313.17,7.0,'Herramientas manuales','2025-06-19'),
	 (87,2072,'Efectivo',321.88,23.0,'Electricidad e iluminación','2025-06-19'),
	 (229,2073,'Efectivo',183.85,6.0,'Productos de ferretería general','2025-06-19'),
	 (94,2074,'Tarjeta',334.79,9.0,'Seguridad industrial','2025-06-19'),
	 (137,2075,'Efectivo',267.95,2.0,'Herramientas eléctricas','2025-06-19'),
	 (197,2076,'Tarjeta',417.2,25.0,'Electricidad e iluminación','2025-06-19'),
	 (200,2077,'Efectivo',79.61,8.0,'Electricidad e iluminación','2025-06-19'),
	 (72,2078,'Efectivo',407.83,10.0,'Tuberías y plomería','2025-06-19'),
	 (37,2079,'Efectivo',367.63,21.0,'Materiales de construcción','2025-06-19'),
	 (212,2080,'Tarjeta',81.83,1.0,'Seguridad industrial','2025-06-19'),
   (119,2081,'Tarjeta',265.33,4.0,'Productos de ferretería general','2025-06-19'),
	 (44,2082,'Efectivo',331.68,23.0,'Materiales de construcción','2025-06-19'),
	 (229,2083,'Efectivo',227.97,11.0,'Productos de ferretería general','2025-06-19'),
	 (129,2084,'Tarjeta',258.29,14.0,'Herramientas manuales','2025-06-19'),
	 (55,2085,'Tarjeta',128.89,5.0,'Pinturas o accesorios','2025-06-19'),
	 (213,2086,'Tarjeta',30.71,14.0,'Seguridad industrial','2025-06-20'),
	 (62,2087,'Efectivo',155.52,1.0,'Tuberías y plomería','2025-06-20'),
	 (183,2088,'Efectivo',253.55,5.0,'Tuberías y plomería','2025-06-20'),
	 (44,2089,'Transferencia',437.59,25.0,'Materiales de construcción','2025-06-20'),
	 (32,2090,'Efectivo',488.56,10.0,'Materiales de construcción','2025-06-20'),
   (182,2091,'Transferencia',185.79,1.0,'Tuberías y plomería','2025-06-20'),
	 (150,2092,'Tarjeta',345.93,11.0,'Herramientas eléctricas','2025-06-20'),
	 (179,2093,'Transferencia',106.2,24.0,'Pinturas o accesorios','2025-06-20'),
	 (40,2094,'Efectivo',329.74,18.0,'Materiales de construcción','2025-06-20'),
	 (207,2095,'Tarjeta',257.26,8.0,'Electricidad e iluminación','2025-06-20'),
	 (218,2096,'Efectivo',498.85,8.0,'Seguridad industrial','2025-06-20'),
	 (208,2097,'Efectivo',398.03,1.0,'Electricidad e iluminación','2025-06-20'),
	 (208,2098,'Tarjeta',312.99,25.0,'Electricidad e iluminación','2025-06-20'),
	 (15,2099,'Efectivo',209.31,23.0,'Herramientas manuales','2025-06-20'),
	 (84,2100,'Transferencia',130.61,12.0,'Electricidad e iluminación','2025-06-20')
   `,

   // Lote 2 (100 registros)
   `
   INSERT INTO productventa (cod_producto,cod_venta,metodo_pago,precio_venta,cantidad_venta,sector,fecha_salida) VALUES
    (79,2101,'Tarjeta',359.42,8.0,'Electricidad e iluminación','2025-06-21'),
	 (229,2102,'Efectivo',383.03,24.0,'Productos de ferretería general','2025-06-21'),
	 (100,2103,'Transferencia',73.95,17.0,'Seguridad industrial','2025-06-21'),
	 (206,2104,'Transferencia',451.09,21.0,'Electricidad e iluminación','2025-06-21'),
	 (195,2105,'Transferencia',300.08,20.0,'Tuberías y plomería','2025-06-21'),
	 (120,2106,'Transferencia',135.82,22.0,'Productos de ferretería general','2025-06-21'),
	 (95,2107,'Tarjeta',330.24,11.0,'Seguridad industrial','2025-06-21'),
	 (144,2108,'Efectivo',384.12,22.0,'Herramientas eléctricas','2025-06-21'),
	 (135,2109,'Transferencia',382.38,6.0,'Herramientas manuales','2025-06-21'),
	 (215,2110,'Transferencia',236.5,23.0,'Seguridad industrial','2025-06-21'),
   (194,2111,'Efectivo',482.1,6.0,'Tuberías y plomería','2025-06-21'),
	 (84,2112,'Transferencia',72.2,1.0,'Electricidad e iluminación','2025-06-21'),
	 (163,2113,'Efectivo',90.54,2.0,'Materiales de construcción','2025-06-21'),
	 (220,2114,'Efectivo',230.96,11.0,'Seguridad industrial','2025-06-21'),
	 (121,2115,'Efectivo',452.54,2.0,'Herramientas manuales','2025-06-21'),
	 (11,2116,'Efectivo',270.84,2.0,'Herramientas manuales','2025-06-22'),
	 (183,2117,'Transferencia',152.49,3.0,'Tuberías y plomería','2025-06-22'),
	 (148,2118,'Efectivo',104.42,14.0,'Herramientas eléctricas','2025-06-22'),
	 (81,2119,'Tarjeta',367.33,7.0,'Electricidad e iluminación','2025-06-22'),
	 (232,2120,'Tarjeta',411.03,3.0,'Productos de ferretería general','2025-06-22'),
   (9,2121,'Tarjeta',467.44,7.0,'Herramientas manuales','2025-06-22'),
	 (56,2122,'Efectivo',191.58,15.0,'Pinturas o accesorios','2025-06-22'),
	 (217,2123,'Transferencia',74.63,12.0,'Seguridad industrial','2025-06-22'),
	 (111,2124,'Tarjeta',31.01,13.0,'Productos de ferretería general','2025-06-22'),
	 (179,2125,'Efectivo',471.05,17.0,'Pinturas o accesorios','2025-06-22'),
	 (148,2126,'Efectivo',468.51,17.0,'Herramientas eléctricas','2025-06-22'),
	 (231,2127,'Tarjeta',260.24,17.0,'Productos de ferretería general','2025-06-22'),
	 (157,2128,'Efectivo',12.16,9.0,'Materiales de construcción','2025-06-22'),
	 (137,2129,'Efectivo',95.42,3.0,'Herramientas eléctricas','2025-06-22'),
	 (207,2130,'Efectivo',211.74,1.0,'Electricidad e iluminación','2025-06-22'),
   (144,2131,'Tarjeta',288.93,5.0,'Herramientas eléctricas','2025-06-23'),
	 (201,2132,'Efectivo',472.52,14.0,'Electricidad e iluminación','2025-06-23'),
	 (189,2133,'Tarjeta',354.28,2.0,'Tuberías y plomería','2025-06-23'),
	 (22,2134,'Transferencia',30.48,5.0,'Herramientas eléctricas','2025-06-23'),
	 (15,2135,'Efectivo',243.39,12.0,'Herramientas manuales','2025-06-23'),
	 (172,2136,'Transferencia',488.86,22.0,'Pinturas o accesorios','2025-06-23'),
	 (2,2137,'Transferencia',288.33,22.0,'Herramientas manuales','2025-06-23'),
	 (203,2138,'Efectivo',206.95,16.0,'Electricidad e iluminación','2025-06-23'),
	 (14,2139,'Tarjeta',439.57,14.0,'Herramientas manuales','2025-06-23'),
	 (65,2140,'Transferencia',231.03,12.0,'Tuberías y plomería','2025-06-23'),
   (62,2141,'Transferencia',384.66,7.0,'Tuberías y plomería','2025-06-23'),
	 (199,2142,'Tarjeta',58.38,25.0,'Electricidad e iluminación','2025-06-23'),
	 (235,2143,'Tarjeta',128.08,22.0,'Productos de ferretería general','2025-06-23'),
	 (176,2144,'Transferencia',67.43,6.0,'Pinturas o accesorios','2025-06-23'),
	 (236,2145,'Transferencia',293.88,1.0,'Productos de ferretería general','2025-06-23'),
	 (202,2146,'Tarjeta',412.59,16.0,'Electricidad e iluminación','2025-06-24'),
	 (74,2147,'Tarjeta',466.49,4.0,'Tuberías y plomería','2025-06-24'),
	 (30,2148,'Transferencia',189.27,6.0,'Herramientas eléctricas','2025-06-24'),
	 (238,2149,'Efectivo',36.75,4.0,'Productos de ferretería general','2025-06-24'),
	 (87,2150,'Transferencia',150.62,8.0,'Electricidad e iluminación','2025-06-24'),
   (112,2151,'Transferencia',438.61,16.0,'Productos de ferretería general','2025-06-24'),
	 (70,2152,'Tarjeta',415.07,21.0,'Tuberías y plomería','2025-06-24'),
	 (228,2153,'Efectivo',390.23,10.0,'Productos de ferretería general','2025-06-24'),
	 (221,2154,'Efectivo',345.94,25.0,'Seguridad industrial','2025-06-24'),
	 (67,2155,'Efectivo',488.34,20.0,'Tuberías y plomería','2025-06-24'),
	 (180,2156,'Transferencia',14.67,11.0,'Pinturas o accesorios','2025-06-24'),
	 (160,2157,'Tarjeta',460.46,3.0,'Materiales de construcción','2025-06-24'),
	 (21,2158,'Transferencia',214.94,15.0,'Herramientas eléctricas','2025-06-24'),
	 (137,2159,'Efectivo',237.16,21.0,'Herramientas eléctricas','2025-06-24'),
	 (76,2160,'Tarjeta',110.54,16.0,'Electricidad e iluminación','2025-06-24'),
   (205,2161,'Transferencia',120.0,6.0,'Electricidad e iluminación','2025-06-25'),
	 (83,2162,'Transferencia',114.24,23.0,'Electricidad e iluminación','2025-06-25'),
	 (127,2163,'Transferencia',452.33,2.0,'Herramientas manuales','2025-06-25'),
	 (156,2164,'Efectivo',40.1,18.0,'Materiales de construcción','2025-06-25'),
	 (30,2165,'Efectivo',425.03,18.0,'Herramientas eléctricas','2025-06-25'),
	 (161,2166,'Transferencia',274.78,4.0,'Materiales de construcción','2025-06-25'),
	 (20,2167,'Tarjeta',68.99,22.0,'Herramientas eléctricas','2025-06-25'),
	 (104,2168,'Tarjeta',30.71,4.0,'Seguridad industrial','2025-06-25'),
	 (48,2169,'Efectivo',61.35,17.0,'Pinturas o accesorios','2025-06-25'),
	 (78,2170,'Tarjeta',231.24,7.0,'Electricidad e iluminación','2025-06-25'),
   (72,2171,'Efectivo',175.75,15.0,'Tuberías y plomería','2025-06-25'),
	 (236,2172,'Transferencia',431.53,17.0,'Productos de ferretería general','2025-06-25'),
	 (142,2173,'Transferencia',310.85,1.0,'Herramientas eléctricas','2025-06-25'),
	 (240,2174,'Transferencia',271.84,3.0,'Productos de ferretería general','2025-06-25'),
	 (152,2175,'Efectivo',280.43,3.0,'Materiales de construcción','2025-06-25'),
	 (17,2176,'Efectivo',1812.5,2.0,'Herramientas eléctricas','2025-06-26'),
	 (32,2176,'Efectivo',162.5,2.0,'Materiales de construcción','2025-06-26'),
	 (47,2176,'Efectivo',68.75,2.0,'Pinturas o accesorios','2025-06-26')
   `
  ];

  let totalInserted = 0;
  
  for (let i = 0; i < batches.length; i++) {
    try {
      await executeQuery(batches[i]);
      totalInserted += 100;
      console.log(`✅ Lote ${i + 1} insertado: ${totalInserted} productos vendidos`);
    } catch (error) {
      console.error(`❌ Error en lote ${i + 1}:`, error.message);
    }
  }

  return totalInserted;
}

// Función principal para insertar datos
async function insertData() {
  try {
    console.log("🚀 Iniciando inserción de datos en PostgreSQL...");

    // Insertar datos en lotes
    const productosVendidosInsertados = await insertProductosVendidos();

    console.log("\n✅ ¡Datos insertados exitosamente!");
    console.log(`🛒 Productos vendidos insertados: ${productosVendidosInsertados}`);

  } catch (error) {
    console.error("❌ Error insertando datos:", error.message);
    throw error;
  }
}

// Función para probar la conexión
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    console.log("✅ Conexión establecida correctamente con PostgreSQL");
    client.release();
    return true;
  } catch (err) {
    console.error("❌ Error al conectar a PostgreSQL:", err.message);
    return false;
  }
}

// Ejecutar el script
async function main() {
  console.log("🔗 Probando conexión a PostgreSQL...");
  const connected = await testConnection();
  
  if (connected) {
    await insertData();
  } else {
    console.log("⚠️ No se pudo conectar a PostgreSQL. Verifica la configuración.");
  }
  
  await pool.end();
  console.log("👋 Conexión cerrada.");
}

// Ejecutar el script principal
main().catch(console.error);