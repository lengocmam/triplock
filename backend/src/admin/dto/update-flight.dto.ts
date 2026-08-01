import { IsString, IsNumber, Min, Max, Length, IsOptional } from 'class-validator';

export class UpdateFlightDto {
  @IsOptional()
  @IsString()
  @Length(2, 10)
  flightCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  departureCity?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  arrivalCity?: string;

  @IsOptional()
  @IsNumber()
  @Min(10000)
  @Max(50000000)
  price?: number;
}