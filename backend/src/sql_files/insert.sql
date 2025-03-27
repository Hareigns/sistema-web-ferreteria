
-- Inserciones para la tabla Proveedor
INSERT INTO Proveedor (Nombre, Apellido, Sector) VALUES
('Pedro', 'Martinez', 'Herramientas'),
('Ana', 'Lopez', 'Construcción'),
('Jorge', 'Hernandez', 'Electricidad');

-- Inserciones para la tabla Producto
INSERT INTO Producto (Cod_Producto, Nombre, Marca, FechaVencimiento, Sector, Estado) VALUES
(1, 'Taladro', 'Bosch', '2026-12-31', 'Herramientas', 'Activo'),
(2, 'Cemento', 'Holcim', '2027-06-15', 'Construcción', 'Activo'),
(3, 'Cable eléctrico', 'Philips', '2028-03-20', 'Electricidad', 'Activo');

-- Inserciones para la tabla Bodega
INSERT INTO Bodega (Sector, Cod_Producto, Cantidad, FechaEntrada) VALUES
('Herramientas', 1, 50, '2025-03-01'),
('Construcción', 2, 100, '2025-03-02'),
('Electricidad', 3, 200, '2025-03-03');

-- Inserciones para la tabla Venta
INSERT INTO Venta (Estado_Venta, Cod_Empleado) VALUES
('Completada', 1),
('Pendiente', 2),
('Cancelada', 3);

-- Inserciones para la tabla ProveProduct
INSERT INTO ProveProduct (Cod_Proveedor, Cod_Producto, Fecha_Entrada, Precio, Cantidad) VALUES
(1, 1, '2025-02-15', 120.50, 30),
(2, 2, '2025-02-16', 9.75, 80),
(3, 3, '2025-02-17', 25.30, 150);

-- Inserciones para la tabla ProductVenta
INSERT INTO ProductVenta (Cod_Producto, Cod_Venta, Metodo_Pago, Precio_Venta, Cantidad_Venta, Sector, Fecha_salida) VALUES
(1, 1, 'Efectivo', 130.00, 5, 'Herramientas', '2025-03-10'),
(2, 2, 'Tarjeta', 10.50, 20, 'Construcción', '2025-03-11'),
(3, 3, 'Transferencia', 27.00, 50, 'Electricidad', '2025-03-12');
