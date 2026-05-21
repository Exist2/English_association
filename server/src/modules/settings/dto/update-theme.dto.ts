/**
 * 更新主题配置 DTO（Data Transfer Object）
 *
 * 用途：定义 POST /api/settings/theme/update 接口的请求体格式和校验规则。
 * 所有字段都是可选的，支持部分更新（只更新传入的字段）。
 *
 * 校验规则：
 * - mode：可选，必须是 'light' 或 'dark'
 * - fontSize：可选，必须是 12-24 之间的整数
 * - hintDuration：可选，必须是 3-30 之间的整数
 *
 * class-validator 装饰器说明：
 * - @IsOptional()：字段可以不传，不传时跳过后续校验
 * - @IsIn([...])：值必须在给定数组中
 * - @IsInt()：值必须是整数（不能是浮点数）
 * - @Min(n) / @Max(n)：数值的最小/最大值限制
 */
import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 更新主题配置请求体 DTO
 * @description 用于校验 POST /api/settings/theme/update 的请求参数
 */
export class UpdateThemeDto {
  /**
   * 主题模式
   * @example 'dark'
   */
  @ApiProperty({
    description: '主题模式：light（明亮）或 dark（暗黑）',
    enum: ['light', 'dark'],
    required: false,
    example: 'dark',
  })
  @IsOptional()
  @IsIn(['light', 'dark'], { message: '主题模式必须是 light 或 dark' })
  mode?: 'light' | 'dark';

  /**
   * 编辑器字号大小（单位 px）
   * @example 16
   */
  @ApiProperty({
    description: '编辑器字号大小，范围 12-24',
    minimum: 12,
    maximum: 24,
    required: false,
    example: 16,
  })
  @IsOptional()
  @IsInt({ message: '字号必须是整数' })
  @Min(12, { message: '字号最小为 12' })
  @Max(24, { message: '字号最大为 24' })
  fontSize?: number;

  /**
   * 联想提示显示时长（单位秒）
   * @example 5
   */
  @ApiProperty({
    description: '联想提示显示时长，范围 3-30 秒',
    minimum: 3,
    maximum: 30,
    required: false,
    example: 5,
  })
  @IsOptional()
  @IsInt({ message: '提示时长必须是整数' })
  @Min(3, { message: '提示时长最小为 3 秒' })
  @Max(30, { message: '提示时长最大为 30 秒' })
  hintDuration?: number;
}
