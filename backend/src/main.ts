import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // tự động loại field không khai báo trong DTO
      forbidNonWhitelisted: true, // báo lỗi nếu client gửi field lạ
      transform: true,        // tự convert type (vd string -> number)
    }),
  );

  app.enableCors(); // cho phép frontend React gọi API (khác port)

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();