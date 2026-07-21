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
  cors: { origin: '*' }, // dev only, production nên giới hạn domain cụ thể
})
export class BookingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('BookingsGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Client join "room" theo flightId để chỉ nhận update của đúng chuyến bay đang xem
  @SubscribeMessage('joinFlight')
  handleJoinFlight(client: Socket, flightId: string) {
    client.join(`flight:${flightId}`);
  }

  // Gọi hàm này từ BookingsService khi có thay đổi trạng thái ghế
  notifySeatLocked(flightId: string, seatId: string, seatNumber: string) {
    this.server.to(`flight:${flightId}`).emit('seatLocked', { seatId, seatNumber });
  }

  notifySeatReleased(flightId: string, seatId: string, seatNumber: string) {
    this.server.to(`flight:${flightId}`).emit('seatReleased', { seatId, seatNumber });
  }

  notifySeatBooked(flightId: string, seatId: string, seatNumber: string) {
    this.server.to(`flight:${flightId}`).emit('seatBooked', { seatId, seatNumber });
  }
}