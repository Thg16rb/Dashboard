import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  @IsNotEmpty()
  providerCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class SetCredentialsDto {
  @IsObject()
  credentials!: Record<string, string>;
}
