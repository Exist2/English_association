/**
 * 滑块验证码校验请求 DTO
 *
 * 用途：校验滑块验证码请求的参数格式。
 * 前端完成滑块验证后，将验证 token 发送到后端进行二次校验。
 */
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CaptchaVerifyDto {
  @ApiProperty({
    description: '中国大陆11位手机号码',
    example: '13800138000',
  })
  @IsString({ message: '手机号必须是字符串' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式无效，请输入11位中国大陆手机号' })
  phone!: string;

  @ApiProperty({
    description: '滑块验证码 token（由前端滑块组件生成）',
    example: 'captcha_token_abc123',
  })
  @IsString({ message: '验证码 token 必须是字符串' })
  captchaToken!: string;
}
