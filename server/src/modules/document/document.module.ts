/**
 * 文档模块
 *
 * 用途：管理用户的文档 CRUD 操作，包括创建、查询、更新、删除文档。
 * 支持分页查询和标题搜索功能。
 *
 * 注册的实体：
 * - Document：用户文档（标题、富文本内容）
 *
 * 提供的服务：
 * - DocumentService：文档业务逻辑（创建、分页查询、详情、更新、删除）
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

@Module({
  imports: [
    /**
     * 注册 Document 实体，使其可以在本模块中通过 Repository 进行数据库操作
     */
    TypeOrmModule.forFeature([Document]),
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
