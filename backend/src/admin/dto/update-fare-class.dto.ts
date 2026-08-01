import { IsNumber, IsOptional, IsBoolean, IsString, Min, Max } from 'class-validator';

export class UpdateFareClassDto {
  @IsOptional()
  @IsNumber()
  @Min(10000)
  @Max(50000000)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  carryOnKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  checkedBaggageKg?: number;

  @IsOptional()
  @IsBoolean()
  refundable?: boolean;

  @IsOptional()
  @IsBoolean()
  changeable?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}