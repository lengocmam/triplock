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
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction } from '../activity-log/entities/activity-log.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private activityLogService: ActivityLogService,
    private mailService: MailService,
  ) {}

  async register(email: string, password: string, fullName: string) {
    const user = await this.usersService.create(email, password, fullName);
    await this.activityLogService.log(
      user.id,
      ActivityAction.REGISTER,
      `Tài khoản ${email} vừa được tạo`,
    );
    return { id: user.id, email: user.email, fullName: user.fullName };
  }

  async sendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Email chưa đăng ký');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${email}`;
    await this.redis.set(key, otp, 'EX', 300);

    // Gửi email thật thay vì chỉ log ra console
    await this.mailService.sendOtpEmail(email, otp);

    return { message: 'OTP đã được gửi tới email của bạn' };
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
    await this.redis.del(key);

    await this.activityLogService.log(
      user.id,
      ActivityAction.VERIFY_OTP,
      'Xác thực OTP thành công',
    );

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

    await this.activityLogService.log(user.id, ActivityAction.LOGIN, 'Đăng nhập vào hệ thống');

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