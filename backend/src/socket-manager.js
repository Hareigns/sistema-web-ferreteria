// socket-manager.js - VERSIÓN CON DEBUG MEJORADO
import { Server } from 'socket.io';

class SocketManager {
  constructor() {
    this.io = null;
    this.clients = new Map();
    this.serverInstanceId = Math.random().toString(36).substring(7); // ID único del servidor
    console.log(`🆔 SERVIDOR SOCKET INICIADO - Instancia: ${this.serverInstanceId}`);
  }

  initialize(server, corsOptions) {
    this.io = new Server(server, corsOptions);
    this.setupEventHandlers();
    
    console.log('='.repeat(70));
    console.log(`🏁 SOCKET MANAGER INICIALIZADO - Instancia: ${this.serverInstanceId}`);
    console.log('='.repeat(70));
    
    return this.io;
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('='.repeat(70));
      console.log(`🌐 NUEVA CONEXIÓN GLOBAL - Instancia: ${this.serverInstanceId}`);
      console.log('   ID:', socket.id);
      
      // Agregar cliente al mapa global
      this.clients.set(socket.id, {
        id: socket.id,
        origin: socket.handshake.headers.origin,
        connectedAt: new Date()
      });

      const totalClients = this.clients.size;
      console.log('   👥 Total de clientes GLOBALES:', totalClients);
      console.log('   🌐 Origen:', socket.handshake.headers.origin);
      console.log('   📊 Clientes globales:', Array.from(this.clients.keys()));
      console.log('   🆔 Instancia servidor:', this.serverInstanceId);
      console.log('='.repeat(70));

      // Unir automáticamente a la sala de productos
      socket.join('products');
      console.log(`   📦 Socket ${socket.id} unido a sala 'products'`);

      // ✅ CRÍTICO: Enviar estado global con ID de instancia
      this.emitToAll('estado_global_actualizado', {
        type: 'nueva_conexion',
        socketId: socket.id,
        totalClients: totalClients,
        clients: Array.from(this.clients.keys()),
        timestamp: new Date().toISOString(),
        message: `Nuevo cliente ${socket.id} conectado. Total: ${totalClients}`,
        serverInstance: this.serverInstanceId,
        serverUptime: process.uptime()
      });

      // Enviar bienvenida individual con info del servidor
      socket.emit('connection_established', {
        message: 'Conexión WebSocket establecida correctamente',
        socketId: socket.id,
        totalClients: totalClients,
        allClients: Array.from(this.clients.keys()),
        timestamp: new Date().toISOString(),
        server: 'Sistema de Gestión de Productos',
        serverInstance: this.serverInstanceId,
        serverUptime: process.uptime()
      });

      // Manejar saludo del cliente
      socket.on('client_hello', (data) => {
        console.log(`   👋 Hello desde cliente ${socket.id}:`, data);
        
        // Responder con info del servidor
        socket.emit('server_hello', {
          message: `¡Hola ${socket.id}! Hay ${totalClients} clientes conectados`,
          timestamp: new Date().toISOString(),
          totalClients: totalClients,
          allClients: Array.from(this.clients.keys()),
          serverInstance: this.serverInstanceId
        });

        // Notificar a otros clientes
        socket.broadcast.emit('cliente_saludo_recibido', {
          clientId: socket.id,
          message: `Cliente ${socket.id} envió saludo`,
          data: data,
          timestamp: new Date().toISOString(),
          totalClients: totalClients,
          allClients: Array.from(this.clients.keys()),
          serverInstance: this.serverInstanceId
        });
      });

      // Sincronización de clientes
      socket.on('sincronizar_clientes', () => {
        console.log(`   🔄 Cliente ${socket.id} solicitó sincronización`);
        this.emitToAll('clientes_sincronizados', {
          clients: Array.from(this.clients.keys()),
          total: totalClients,
          timestamp: new Date().toISOString(),
          action: 'sincronizacion_manual',
          serverInstance: this.serverInstanceId
        });
      });

      // Obtener estado del servidor
      socket.on('obtener_estado_servidor', () => {
        console.log(`   📊 Cliente ${socket.id} solicitó estado del servidor`);
        socket.emit('estado_servidor', {
          totalClients: totalClients,
          clients: Array.from(this.clients.keys()),
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          serverInstance: this.serverInstanceId,
          processId: process.pid
        });
      });

      // Test de conexión
      socket.on('test_conexion', () => {
        console.log(`   🧪 Cliente ${socket.id} hizo test de conexión`);
        socket.emit('test_respuesta', {
          message: 'Test exitoso',
          timestamp: new Date().toISOString(),
          serverInstance: this.serverInstanceId,
          totalClients: totalClients,
          clients: Array.from(this.clients.keys())
        });
      });

      // Manejar desconexión
      socket.on('disconnect', (reason) => {
        console.log('🔌 DESCONEXIÓN GLOBAL WebSocket:');
        console.log('   ID:', socket.id);
        console.log('   Razón:', reason);
        
        // Remover cliente del mapa global
        this.clients.delete(socket.id);
        const newTotal = this.clients.size;
        
        console.log('   👥 Clientes restantes:', newTotal);
        console.log('   📊 Clientes globales:', Array.from(this.clients.keys()));
        console.log('   🆔 Instancia servidor:', this.serverInstanceId);

        // Notificar a todos sobre la desconexión
        this.emitToAll('estado_global_actualizado', {
          type: 'desconexion',
          socketId: socket.id,
          totalClients: newTotal,
          clients: Array.from(this.clients.keys()),
          timestamp: new Date().toISOString(),
          message: `Cliente ${socket.id} desconectado. Total: ${newTotal}`,
          reason: reason,
          serverInstance: this.serverInstanceId
        });
      });

      socket.on('error', (error) => {
        console.error('❌ ERROR en Socket:', error);
      });
    });
  }

  // Emitir a todos los clientes
  emitToAll(event, data) {
    if (this.io) {
      this.io.emit(event, data);
      console.log(`   📢 [${event}] emitido a ${this.clients.size} clientes desde instancia ${this.serverInstanceId}`);
    }
  }

  // Obtener estadísticas
  getStats() {
    return {
      totalClients: this.clients.size,
      clients: Array.from(this.clients.keys()),
      uptime: process.uptime(),
      serverInstance: this.serverInstanceId,
      processId: process.pid
    };
  }
}

// Instancia global única
const socketManager = new SocketManager();
export default socketManager;