CREATE DATABASE ferreteria;

USE ferreteria;

CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(16) NOT NULL,
    password VARCHAR(60) NOT NULL,
    fullname VARCHAR(100) NOT NULL
);

SELECT * FROM users;

-- DELETE FROM users;

-- ------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- eliminar la tabla si existe
DROP TABLE IF EXISTS Producto;  
-- tabla Producto
CREATE TABLE Producto (
    Cod_Producto INT PRIMARY KEY,
    Nombre VARCHAR(50),
    Marca VARCHAR(50),
    FechaVencimiento DATE,
	Sector VARCHAR(50)
);

ALTER TABLE Producto ADD Estado NVARCHAR(20) DEFAULT 'Activo';
SELECT * FROM Producto;

-- ------------------------------------------------------------------------------------------------------------------------------------------------------------------

-- ALTER DATABASE ferreteria
-- SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
-- GO

-- eliminar la tabla si existe
DROP TABLE IF EXISTS Proveedor;  
-- tabla Proveedor
CREATE TABLE Proveedor (
    Cod_Proveedor INT AUTO_INCREMENT PRIMARY KEY,
    Nombre NVARCHAR(50),
    Apellido NVARCHAR(50),
	Sector VARCHAR(50)
);

SELECT * FROM Proveedor;

-- ------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- eliminar la tabla si existe
DROP TABLE IF EXISTS Bodega;  
-- tabla Bodega
CREATE TABLE Bodega (
    Sector VARCHAR(50),
    Cod_Producto INT,
    Cantidad INT,
    FechaEntrada DATE,
    PRIMARY KEY (Sector, Cod_Producto),
    FOREIGN KEY (Cod_Producto) REFERENCES Producto(Cod_Producto)
);

SELECT * FROM Bodega;

-- ------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- eliminar la tabla si existe
DROP TABLE IF EXISTS Empleado;  
-- tabla Empleado
CREATE TABLE Empleado (
    Cod_Empleado INT PRIMARY KEY,
    Nombre NVARCHAR(50),
    Apellido NVARCHAR(50),
    Direccion NVARCHAR(100)
);


INSERT INTO Empleado (Cod_Empleado, Nombre, Apellido, Direccion)
VALUES 
    (1, 'Luis', 'Torres', 'Barrio San Luis'),
    (2, 'Tatiana', 'Mendoza', 'Colonia Centroam�rica'),
	(3, 'Eduardo', 'Alvarado', 'El Rastro');

SELECT * FROM Empleado;


-- ------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- eliminar la tabla si existe
DROP TABLE IF EXISTS Venta;  
-- tabla Venta
CREATE TABLE Venta (
    Cod_Venta INT AUTO_INCREMENT PRIMARY KEY,
	Estado_Venta NVARCHAR(50),
	Cod_Empleado INT,
    FOREIGN KEY (Cod_Empleado) REFERENCES Empleado(Cod_Empleado)
);

SELECT * FROM Venta;

-- ------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- eliminar la tabla si existe
DROP TABLE IF EXISTS ProveProduct;  
-- tabla ProveProduct (relaci�n M a M entre Proveedor y Producto)
CREATE TABLE ProveProduct (
    Cod_Proveedor INT,
    Cod_Producto INT,
	Fecha_Entrada date,
	Precio float,
	Cantidad int,
    PRIMARY KEY (Cod_Proveedor, Cod_Producto),
    FOREIGN KEY (Cod_Proveedor) REFERENCES Proveedor(Cod_Proveedor),
    FOREIGN KEY (Cod_Producto) REFERENCES Producto(Cod_Producto)
);

	SELECT * FROM ProveProduct;

-- ------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- para eliminar la tabla si existe
DROP TABLE IF EXISTS ProductVenta;  
CREATE TABLE ProductVenta (
    Cod_Producto INT,
	Cod_Venta INT,
	Metodo_Pago NVARCHAR(50),
	Precio_Venta float,
	Cantidad_Venta float,
	Sector NVARCHAR(50),
	Fecha_salida date,
	PRIMARY KEY (Cod_Venta, Cod_Producto),
    FOREIGN KEY (Cod_Producto) REFERENCES Producto(Cod_Producto),
	FOREIGN KEY (Cod_Venta) REFERENCES Venta(Cod_Venta)
);

SELECT * FROM ProductVenta;

-- ------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- eliminar la tabla si existe
DROP TABLE IF EXISTS Telefono;  
-- tabla Telefono
CREATE TABLE Telefono (
    Numero VARCHAR(9) PRIMARY KEY, 
    Compania VARCHAR(50) NOT NULL,             
    Cod_Proveedor INT NULL,                    
    Cod_Empleado INT NULL,                      
    FOREIGN KEY (Cod_Proveedor) REFERENCES Proveedor(Cod_Proveedor),
    FOREIGN KEY (Cod_Empleado) REFERENCES Empleado(Cod_Empleado) 
);


INSERT INTO Telefono(Numero, Compania, Cod_Proveedor, Cod_Empleado)
VALUES
('1234-5678', 'Tigo', NULL, 1),
('8765-4321', 'Claro', NULL, 2),
('8680-0409', 'Tigo', NULL, 3);

-- validar que la compa�ia solo puede ser 'CLARO' o 'TIGO'
ALTER TABLE Telefono
ADD CONSTRAINT CHK_Compania CHECK ([Compania] IN ('CLARO', 'TIGO'));

-- Agregar la restricci�n CHECK para validar el formato del tel�fono
ALTER TABLE Telefono
ADD CONSTRAINT CHK_Telefono CHECK (numero LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]');

-- delete constraint CHK_Telefono

SELECT * FROM Telefono;
