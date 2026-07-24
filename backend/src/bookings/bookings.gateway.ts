import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

const LOBBY_ROOM = 'flights_lobby';

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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // Tự động join lobby ngay khi kết nối, để nhận cập nhật số ghế trống của mọi chuyến bay
    client.join(LOBBY_ROOM);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinFlight')
  handleJoinFlight(client: Socket, flightId: string) {
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

  // Bắn ra TOÀN BỘ client đang mở trang danh sách (không chỉ ai đang xem đúng chuyến bay đó)
  // để cập nhật số ghế trống trên từng thẻ chuyến bay theo thời gian thực
  notifyFlightSeatsChanged(flightId: string, availableSeats: number) {
    this.server.to(LOBBY_ROOM).emit('flightSeatsChanged', { flightId, availableSeats });
  }
}