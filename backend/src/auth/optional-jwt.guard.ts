import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Không throw lỗi nếu không có token hoặc token không hợp lệ — chỉ đơn giản không gán req.user
  handleRequest(err: any, user: any) {
    return user || null;
  }
}
