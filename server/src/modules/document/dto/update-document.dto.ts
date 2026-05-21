/**
 * 更新文档请求 DTO
 *
 * 用途：校验更新文档接口的请求体参数。
 *
 * 验证规则：
 * - title：可选，字符串类型，长度 1-50 字符
 * - content：可选，字符串类型
 *
 * 注意：title 和 content 至少需要提供一个（但 class-validator 不强制此规则，
 * 如果两个都不传，Service 层会直接返回原文档不做修改）
 */
import { IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDocumentDto {
  /**
   * 文档标题（可选）
   * @description 如果提供，则更新文档标题
   */
  @ApiProperty({
    description: '文档标题',
    example: '更新后的标题',
    minLength: 1,
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString({ message: '标题必须是字符串' })
  @Length(1, 50, { message: '标题长度必须在1到50个字符之间' })
  title?: string;

  /**
   * 文档内容（可选）
   * @description 如果提供，则更新文档内容
   */
  @ApiProperty({
    description: '文档内容（富文本 JSON）',
    example: '{"type":"doc","content":[{"type":"paragraph"}]}',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '内容必须是字符串' })
  content?: string;
}
