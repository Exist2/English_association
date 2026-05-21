/**
 * 发送短信验证码请求 DTO
 *
 * 用途：校验发送短信验证码请求的手机号格式。
 */
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendSmsDto {
  @ApiProperty({
    description: '中国大陆11位手机号码',
    example: '13800138000',
  })
  @IsString({ message: '手机号必须是字符串' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式无效，请输入11位中国大陆手机号' })
  phone!: string;
}
