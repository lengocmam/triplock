import { IsString, IsNumber, IsDateString, Min, Max, Length } from 'class-validator';

export class CreateFlightDto {
  @IsString()
  @Length(2, 10)
  flightCode!: string;

  @IsString()
  @Length(1, 50)
  departureCity!: string;

  @IsString()
  @Length(1, 50)
  arrivalCity!: string;

  @IsDateString()
  departureTime!: string;

  @IsDateString()
  arrivalTime!: string;

  @IsNumber()
  @Min(10000)
  @Max(50000000)
  price!: number;

  @IsNumber()
  @Min(1)
  @Max(300)
  seatCount!: number;
}