import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard-stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('revenue-chart')
  getRevenueChart() {
    return this.adminService.getRevenueChart();
  }

  @Get('top-routes')
  getTopRoutes() {
    return this.adminService.getTopRoutes();
  }

  @Get('fare-class-breakdown')
  getFareClassBreakdown() {
    return this.adminService.getFareClassBreakdown();
  }

  @Get('flights')
  getAllFlights() {
    return this.adminService.getAllFlightsWithStats();
  }

  @Post('flights')
  createFlight(@Body() body: any) {
    return this.adminService.createFlight(body);
  }

  @Delete('flights/:id')
  deleteFlight(@Param('id') id: string) {
    return this.adminService.deleteFlight(id);
  }

  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('bookings')
  getAllBookings() {
    return this.adminService.getAllBookings();
  }
}