/**
 * 创建文档请求 DTO
 *
 * 用途：校验创建文档接口的请求体参数。
 *
 * 验证规则：
 * - title：必填，字符串类型，长度 1-50 字符
 * - content：必填，字符串类型（富文本 JSON 内容）
 */
import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentDto {
  /**
   * 文档标题
   * @description 用户输入的文档标题，长度限制 1-50 字符
   */
  @ApiProperty({
    description: '文档标题',
    example: '我的第一篇文档',
    minLength: 1,
    maxLength: 50,
  })
  @IsString({ message: '标题必须是字符串' })
  @Length(1, 50, { message: '标题长度必须在1到50个字符之间' })
  title!: string;

  /**
   * 文档内容
   * @description Tiptap 编辑器序列化后的 JSON 字符串
   */
  @ApiProperty({
    description: '文档内容（富文本 JSON）',
    example: '{"type":"doc","content":[]}',
  })
  @IsString({ message: '内容必须是字符串' })
  content!: string;
}
