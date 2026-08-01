import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
  // Route promote-admin đã bị xóa vì là lỗ hổng bảo mật nghiêm trọng (privilege escalation)
  // Nâng quyền admin chỉ thực hiện qua SQL trực tiếp trong Supabase, không qua API công khai
}