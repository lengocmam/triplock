import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // CHỈ dùng để setup tài khoản admin đầu tiên — nên xóa route này sau khi đã có admin
  @Post('promote-admin')
  promote(@Body('email') email: string) {
    return this.usersService.promoteToAdmin(email);
  }
}