import { IsNotEmpty, Max, IsNumber, IsString } from 'class-validator';
export class presignedDTO {
  @IsNotEmpty()
  @IsString()
  filename!: string;
  @IsNotEmpty()
  @IsString()
  filetype!: string;
  @IsNotEmpty()
  @IsNumber()
  @Max(100 * 1024 * 1024, { message: 'file excceds its limit' })
  filesize!: number;
}
