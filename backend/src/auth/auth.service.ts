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

    // Không tiết lộ email có tồn tại hay không -- luôn trả về cùng 1 message
    // để chống enumeration attack, dù thực tế có gửi email hay không
    if (!user) {
      return { message: 'Nếu email tồn tại trong hệ thống, OTP đã được gửi' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${email}`;
    await this.redis.set(key, otp, 'EX', 300);

    await this.mailService.sendOtpEmail(email, otp);

    return { message: 'Nếu email tồn tại trong hệ thống, OTP đã được gửi' };
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
    const lockKey = `login_lock:${email}`;
    const attemptsKey = `login_attempts:${email}`;

    const isLocked = await this.redis.get(lockKey);
    if (isLocked) {
      throw new UnauthorizedException('Tài khoản tạm khóa do đăng nhập sai nhiều lần, thử lại sau 15 phút');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      await this.recordFailedAttempt(attemptsKey, lockKey);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isValid = await this.usersService.validatePassword(password, user.password);
    if (!isValid) {
      await this.recordFailedAttempt(attemptsKey, lockKey);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Đăng nhập đúng -> xóa bộ đếm sai
    await this.redis.del(attemptsKey);

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
        role: user.role,
      },
    };
  }

  private async recordFailedAttempt(attemptsKey: string, lockKey: string) {
    const attempts = await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, 900); // reset bộ đếm sau 15 phút không có lần sai nào mới

    if (attempts >= 5) {
      await this.redis.set(lockKey, '1', 'EX', 900); // khóa 15 phút sau 5 lần sai
    }
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Không tiết lộ email có tồn tại hay không -- chống enumeration, giống nguyên tắc đã áp dụng ở sendOtp
    if (!user) {
      return { message: 'Nếu email tồn tại trong hệ thống, mã đặt lại mật khẩu đã được gửi' };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `password_reset:${email}`;
    await this.redis.set(key, resetCode, 'EX', 600); // 10 phút, dài hơn OTP đăng ký vì user cần thời gian đọc email

    await this.mailService.sendPasswordResetEmail(email, resetCode);

    return { message: 'Nếu email tồn tại trong hệ thống, mã đặt lại mật khẩu đã được gửi' };
  }

  async resetPassword(email: string, resetCode: string, newPassword: string) {
    const key = `password_reset:${email}`;
    const savedCode = await this.redis.get(key);

    if (!savedCode || savedCode !== resetCode) {
      throw new BadRequestException('Mã xác nhận không đúng hoặc đã hết hạn');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản');
    }

    await this.usersService.updatePassword(user.id, newPassword);
    await this.redis.del(key);

    await this.activityLogService.log(user.id, ActivityAction.LOGIN, 'Đặt lại mật khẩu thành công');

    return { message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại' };
  }
}