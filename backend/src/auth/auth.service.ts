import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { UsersService } from '../users/users.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async register(email: string, password: string, fullName: string) {
    const user = await this.usersService.create(email, password, fullName);
    return { id: user.id, email: user.email, fullName: user.fullName };
  }

  // Giả lập gửi OTP: tạo mã 6 số, lưu Redis với TTL 5 phút
  async sendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Email chưa đăng ký');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${email}`;

    await this.redis.set(key, otp, 'EX', 300); // hết hạn sau 300s = 5 phút

    // Thực tế sẽ gọi service SMS/Email ở đây. Giờ chỉ log ra console để demo.
    console.log(`[OTP giả lập] Gửi tới ${email}: ${otp}`);

    return { message: 'OTP đã được gửi (xem console log)' };
  }

  async verifyOtp(email: string, otp: string) {
    const key = `otp:${email}`;
    const savedOtp = await this.redis.get(key);

    if (!savedOtp || savedOtp !== otp) {
      throw new BadRequestException('OTP không đúng hoặc đã hết hạn');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Không tìm thấy user');
    }

    await this.usersService.markAsVerified(user.id);
    await this.redis.del(key); // xóa OTP sau khi dùng, tránh dùng lại

    return { message: 'Xác thực thành công' };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isValid = await this.usersService.validatePassword(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isVerified: user.isVerified,
      },
    };
  }
}