import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5173'],
    credentials: true,
  },
})
export class BookingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('BookingsGateway');
  private joinCounts = new Map<string, number>(); // đếm số lần join theo socket.id, chống spam

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.joinCounts.set(client.id, 0);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.joinCounts.delete(client.id);
  }

  @SubscribeMessage('joinFlight')
  handleJoinFlight(client: Socket, flightId: string) {
    const count = this.joinCounts.get(client.id) || 0;
    if (count > 50) {
      // 1 client bình thường không cần join quá 50 phòng khác nhau trong 1 phiên
      client.disconnect();
      return;
    }
    this.joinCounts.set(client.id, count + 1);
    client.join(`flight:${flightId}`);
  }

  @SubscribeMessage('leaveFlight')
  handleLeaveFlight(client: Socket, flightId: string) {
    client.leave(`flight:${flightId}`);
  }

  notifySeatLocked(flightId: string, seatId: string, seatNumber: string) {
    this.server.to(`flight:${flightId}`).emit('seatLocked', { seatId, seatNumber });
  }

  notifySeatReleased(flightId: string, seatId: string, seatNumber: string) {
    this.server.to(`flight:${flightId}`).emit('seatReleased', { seatId, seatNumber });
  }

  notifySeatBooked(flightId: string, seatId: string, seatNumber: string) {
    this.server.to(`flight:${flightId}`).emit('seatBooked', { seatId, seatNumber });
  }

  notifyFlightSeatsChanged(flightId: string, availableSeats: number) {
    this.server.to('flights_lobby').emit('flightSeatsChanged', { flightId, availableSeats });
  }
}