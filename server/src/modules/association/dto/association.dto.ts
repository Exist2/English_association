/**
 * 联想请求 DTO（Data Transfer Object）
 *
 * 用途：校验联想请求的参数格式。
 * 当用户在编辑器中输入文本后，前端会将文本发送到后端进行语言检测和联想。
 *
 * 字段说明：
 * - text：用户输入的文本内容，必填，不能为空
 * - language：可选字段，前端可以传入用户界面当前的语言偏好（'zh' 或 'en'）
 *   目前后端使用自己的 detectLanguage 方法检测语言，此字段保留供未来使用
 */
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssociationDto {
  @ApiProperty({
    description: '用户输入的文本内容',
    example: '你好世界',
    minLength: 1,
  })
  @IsString({ message: '文本内容必须是字符串' })
  @IsNotEmpty({ message: '文本内容不能为空' })
  text!: string;

  @ApiProperty({
    description: '语言类型（可选），前端传入的语言偏好，后端使用自动检测',
    example: 'zh',
    enum: ['zh', 'en'],
    required: false,
  })
  @IsOptional()
  @IsIn(['zh', 'en'], { message: '语言类型只能是 zh 或 en' })
  language?: 'zh' | 'en';
}
