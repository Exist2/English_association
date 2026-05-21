/**
 * 注册请求 DTO
 *
 * 用途：校验用户注册时提交的手机号格式。
 *
 * class-validator 装饰器说明：
 * - @IsString()：确保值是字符串类型
 * - @Matches()：使用正则表达式校验字符串格式
 *
 * 正则说明：/^1[3-9]\d{9}$/
 * - ^1：以数字 1 开头
 * - [3-9]：第二位是 3 到 9 之间的数字
 * - \d{9}：后面跟 9 位任意数字
 * - $：字符串结束
 * 总共 11 位，匹配中国大陆手机号格式
 */
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: '中国大陆11位手机号码',
    example: '13800138000',
    pattern: '^1[3-9]\\d{9}$',
  })
  @IsString({ message: '手机号必须是字符串' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式无效，请输入11位中国大陆手机号' })
  phone!: string;
}
