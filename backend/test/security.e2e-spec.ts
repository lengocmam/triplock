import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security Guards (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('từ chối password yếu khi đăng ký', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `weak_${Date.now()}@test.com`, password: '123456', fullName: 'Test' });
    expect(res.status).toBe(400);
  });

  it('từ chối field lạ không khai báo trong DTO (mass assignment protection)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `ma_${Date.now()}@test.com`,
        password: 'Test@12345',
        fullName: 'Test',
        role: 'admin', // cố gắng tự nâng quyền qua field lạ
      });
    expect(res.status).toBe(400); // forbidNonWhitelisted phải chặn field 'role'
  });

  it('chặn tạo chuyến bay khi chưa đăng nhập', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/flights')
      .send({ flightCode: 'XX999', price: 1000000 });
    expect(res.status).toBe(401);
  });

  it('validate giá vé vượt giới hạn khi tạo chuyến bay (nếu có token admin hợp lệ, cần set riêng)', async () => {
    // Test này minh họa cấu trúc -- cần token admin thật để chạy đầy đủ trong CI với tài khoản seed sẵn
    const res = await request(app.getHttpServer())
      .post('/admin/flights')
      .set('Authorization', 'Bearer invalid-token')
      .send({ price: 999999999999 });
    expect(res.status).toBe(401); // chặn ở tầng auth trước khi tới validate DTO
  });
});