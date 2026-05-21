/**
 * 联想模块
 *
 * 用途：处理文本语言检测和联想/翻译请求。
 * 当用户输入中文时返回英文翻译，输入英文时返回联想词汇。
 *
 * 组成：
 * - AssociationController：处理 HTTP 请求（POST /api/association）
 * - AssociationService：核心业务逻辑（语言检测、联想/翻译）
 */
import { Module } from '@nestjs/common';
import { AssociationController } from './association.controller';
import { AssociationService } from './association.service';

@Module({
  imports: [],
  controllers: [AssociationController],
  providers: [AssociationService],
  exports: [AssociationService],
})
export class AssociationModule {}
