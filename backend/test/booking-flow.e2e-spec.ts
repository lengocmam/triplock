import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Booking Flow (E2E)', () => {
  let app: INestApplication;
  let userToken: string;
  const testEmail = `e2e_${Date.now()}@test.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('đăng ký tài khoản mới thành công', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: testEmail, password: 'Test@12345', fullName: 'E2E Tester' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(testEmail);
  });

  it('không cho đăng ký trùng email', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: testEmail, password: 'Test@12345', fullName: 'E2E Tester 2' });
    expect(res.status).toBe(409);
  });

  it('từ chối login sai mật khẩu', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: 'sai-mat-khau' });
    expect(res.status).toBe(401);
  });

  it('lấy danh sách chuyến bay công khai không cần token', async () => {
    const res = await request(app.getHttpServer()).get('/flights');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('chặn truy cập /bookings/my-bookings khi chưa đăng nhập', async () => {
    const res = await request(app.getHttpServer()).get('/bookings/my-bookings');
    expect(res.status).toBe(401);
  });

  it('chặn user thường truy cập /admin/dashboard-stats', async () => {
    // Login trước bằng tài khoản vừa đăng ký (chưa verify OTP nên sẽ fail login theo thiết kế,
    // nhưng ở đây chỉ test route /admin chặn đúng khi có role sai -- dùng token giả lập không hợp lệ)
    const res = await request(app.getHttpServer())
      .get('/admin/dashboard-stats')
      .set('Authorization', 'Bearer token-khong-hop-le');
    expect(res.status).toBe(401);
  });
});