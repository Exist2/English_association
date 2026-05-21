/**
 * 登录请求 DTO
 *
 * 用途：校验登录请求的手机号和验证码格式。
 *
 * 验证码规则：
 * - 必须是字符串类型
 * - 长度固定为 6 位（@Length(6, 6)）
 */
import { IsString, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: '中国大陆11位手机号码',
    example: '13800138000',
  })
  @IsString({ message: '手机号必须是字符串' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式无效，请输入11位中国大陆手机号' })
  phone!: string;

  @ApiProperty({
    description: '6位数字短信验证码',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString({ message: '验证码必须是字符串' })
  @Length(6, 6, { message: '验证码必须为6位' })
  code!: string;
}
