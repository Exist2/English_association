/**
 * 查询文档列表请求 DTO
 *
 * 用途：校验文档列表查询接口的 Query 参数。
 *
 * 验证规则：
 * - page：可选，正整数，默认值 1
 * - pageSize：可选，正整数，范围 1-100，默认值 20
 * - search：可选，字符串，用于标题模糊搜索
 *
 * 关于 class-transformer 的 @Type() 装饰器：
 * - Query 参数从 URL 中解析时都是字符串类型
 * - @Type(() => Number) 会自动将字符串 "1" 转换为数字 1
 * - 如果不加 @Type()，class-validator 的 @IsInt() 会因为收到字符串而报错
 */
import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryDocumentDto {
  /**
   * 页码
   * @description 从 1 开始的页码，默认为 1
   */
  @ApiProperty({
    description: '页码（从1开始）',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为1' })
  page: number = 1;

  /**
   * 每页条数
   * @description 每页返回的文档数量，范围 1-100，默认为 20
   */
  @ApiProperty({
    description: '每页条数（1-100）',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页条数必须是整数' })
  @Min(1, { message: '每页条数最小为1' })
  @Max(100, { message: '每页条数最大为100' })
  pageSize: number = 20;

  /**
   * 搜索关键词（可选）
   * @description 按文档标题进行模糊搜索，不区分大小写
   */
  @ApiProperty({
    description: '搜索关键词（按标题模糊匹配）',
    example: '英文',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '搜索关键词必须是字符串' })
  search?: string;
}
