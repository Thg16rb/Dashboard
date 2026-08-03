import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateRuleDto {
  @IsEnum(['TAX', 'FEE', 'OPCOST'])
  kind!: 'TAX' | 'FEE' | 'OPCOST';

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['PERCENT', 'FIXED'])
  calcType!: 'PERCENT' | 'FIXED';

  @IsNumber()
  value!: number;
}
