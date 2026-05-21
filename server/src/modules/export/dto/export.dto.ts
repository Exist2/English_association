/**
 * 导出请求 DTO（Data Transfer Object）
 *
 * 用途：定义导出接口的请求体格式和校验规则。
 *
 * 字段说明：
 * - format：导出格式，只允许 'docx' 或 'pdf' 两个值
 *
 * 校验规则：
 * - format 必须是字符串类型
 * - format 的值必须是 'docx' 或 'pdf' 之一（使用 @IsIn 装饰器）
 *
 * 为什么需要 DTO？
 * - 将请求体的校验逻辑从控制器中分离出来，保持控制器代码简洁
 * - class-validator 会在请求到达控制器之前自动校验，不合法的请求直接返回 400 错误
 * - @ApiProperty 装饰器让 Swagger 文档自动生成请求体的描述
 */
import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 导出请求 DTO
 * @description 用于 POST /api/export/:id 接口的请求体校验
 */
export class ExportDto {
  /**
   * 导出格式
   * @description 指定导出文件的格式，支持 Word (.docx) 和 PDF (.pdf)
   * @example 'docx'
   */
  @ApiProperty({
    description: '导出格式',
    enum: ['docx', 'pdf'],
    example: 'docx',
  })
  @IsString({ message: '导出格式必须是字符串' })
  @IsIn(['docx', 'pdf'], { message: '导出格式只能是 docx 或 pdf' })
  format!: 'docx' | 'pdf';
}
