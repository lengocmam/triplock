import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private logger = new Logger('MailService');

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.config.get('GMAIL_USER'),
        pass: this.config.get('GMAIL_APP_PASSWORD'),
      },
    });
  }

  async sendOtpEmail(toEmail: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"TripLock" <${this.config.get('GMAIL_USER')}>`,
        to: toEmail,
        subject: 'Mã xác thực TripLock của bạn',
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #0071eb;">✈️ TripLock</h2>
            <p>Mã xác thực (OTP) của bạn là:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0071eb; text-align: center; padding: 16px; background: #eef4ff; border-radius: 8px; margin: 16px 0;">
              ${otp}
            </div>
            <p style="color: #6b7280; font-size: 13px;">Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
          </div>
        `,
      });
      this.logger.log(`Đã gửi OTP tới ${toEmail}`);
    } catch (error) {
      this.logger.error(`Gửi email thất bại: ${error.message}`);
      throw error;
    }
  }

  async sendBookingConfirmationEmail(
    toEmail: string,
    bookingCode: string,
    passengerCount: number,
    flightInfo: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"TripLock" <${this.config.get('GMAIL_USER')}>`,
        to: toEmail,
        subject: `Xác nhận đặt vé thành công - Mã ${bookingCode}`,
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #12a150;">✅ Đặt vé thành công!</h2>
            <p><strong>Mã đặt chỗ:</strong> ${bookingCode}</p>
            <p><strong>Chuyến bay:</strong> ${flightInfo}</p>
            <p><strong>Số hành khách:</strong> ${passengerCount}</p>
            <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">Cảm ơn bạn đã sử dụng TripLock.</p>
          </div>
        `,
      });
      this.logger.log(`Đã gửi email xác nhận vé tới ${toEmail}`);
    } catch (error) {
      this.logger.error(`Gửi email xác nhận thất bại: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(toEmail: string, resetCode: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"TripLock" <${this.config.get('GMAIL_USER')}>`,
        to: toEmail,
        subject: 'Đặt lại mật khẩu TripLock',
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #0071eb;">🔐 Đặt lại mật khẩu</h2>
            <p>Mã xác nhận đặt lại mật khẩu của bạn là:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0071eb; text-align: center; padding: 16px; background: #eef4ff; border-radius: 8px; margin: 16px 0;">
              ${resetCode}
            </div>
            <p style="color: #6b7280; font-size: 13px;">Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
          </div>
        `,
      });
      this.logger.log(`Đã gửi mã reset password tới ${toEmail}`);
    } catch (error) {
      this.logger.error(`Gửi email reset password thất bại: ${error.message}`);
      throw error;
    }
  }
}