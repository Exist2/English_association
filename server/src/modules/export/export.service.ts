/**
 * 导出服务（ExportService）
 *
 * 用途：将用户文档导出为 Word (.docx) 或 PDF (.pdf) 格式。
 *
 * 核心功能：
 * - exportToDocx：使用 docx 库生成 Word 文件，保留格式（加粗、斜体、下划线、标题、列表）
 * - exportToPdf：使用 pdfkit 库生成 PDF 文件，保留基本格式和段落结构
 * - export：整合导出逻辑，包含文档归属验证、空文档检测、30秒超时控制
 *
 * 设计要点：
 * - Tiptap 编辑器将内容存储为 JSON 格式，需要解析 JSON 并转换为对应格式
 * - 导出操作有 30 秒超时限制，超时后抛出 GatewayTimeoutException
 * - 空文档（无内容）不允许导出，会抛出 BadRequestException
 *
 * 依赖：
 * - docx：生成 .docx 文件的 npm 包
 * - pdfkit：生成 .pdf 文件的 npm 包
 * - DocumentService：获取文档数据并验证归属权
 */
import {
  Injectable,
  BadRequestException,
  GatewayTimeoutException,
} from '@nestjs/common';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import PDFDocument from 'pdfkit';
import { DocumentService } from '../document/document.service';

/**
 * Tiptap 文本标记接口
 * @description Tiptap 编辑器中文本的格式标记（加粗、斜体、下划线等）
 */
interface TiptapMark {
  /** 标记类型：bold（加粗）、italic（斜体）、underline（下划线） */
  type: string;
}

/**
 * Tiptap 内容节点接口
 * @description Tiptap 编辑器 JSON 中的内容节点，可以是文本、段落、标题、列表等
 */
interface TiptapNode {
  /** 节点类型：doc、paragraph、heading、text、bulletList、orderedList、listItem 等 */
  type: string;
  /** 子节点列表（段落、列表项等包含子节点） */
  content?: TiptapNode[];
  /** 文本内容（仅 text 类型节点有此字段） */
  text?: string;
  /** 文本格式标记列表（加粗、斜体等） */
  marks?: TiptapMark[];
  /** 节点属性（如标题级别 level） */
  attrs?: Record<string, unknown>;
}

/** 导出操作的超时时间（毫秒）：30秒 */
const EXPORT_TIMEOUT_MS = 30000;

@Injectable()
export class ExportService {
  constructor(
    /**
     * 文档服务
     * @description 用于获取文档数据和验证文档归属权
     */
    private readonly documentService: DocumentService,
  ) {}

  /**
   * 导出文档（统一入口方法）
   *
   * 流程：
   * 1. 通过 DocumentService 获取文档（同时验证归属权）
   * 2. 检测文档内容是否为空 → 空文档拒绝导出
   * 3. 根据 format 参数调用对应的导出方法
   * 4. 使用 Promise.race 实现 30 秒超时控制
   *
   * @param docId - 要导出的文档 ID
   * @param userId - 当前登录用户的 ID（用于验证归属权）
   * @param format - 导出格式：'docx' 或 'pdf'
   * @returns 生成的文件 Buffer（二进制数据）
   * @throws NotFoundException 文档不存在或不属于当前用户
   * @throws BadRequestException 文档内容为空
   * @throws GatewayTimeoutException 导出操作超过 30 秒
   */
  async export(
    docId: string,
    userId: string,
    format: 'docx' | 'pdf',
  ): Promise<Buffer> {
    // 步骤1：获取文档（DocumentService.findOne 会验证归属权，不存在则抛 NotFoundException）
    const document = await this.documentService.findOne(userId, docId);

    // 步骤2：检测文档内容是否为空
    // 空文档不允许导出，需要提示用户先添加内容
    if (this.isContentEmpty(document.content)) {
      throw new BadRequestException('文档内容为空，无法导出');
    }

    // 步骤3：根据格式选择导出方法
    const exportPromise =
      format === 'docx'
        ? this.exportToDocx({ title: document.title, content: document.content })
        : this.exportToPdf({ title: document.title, content: document.content });

    // 步骤4：使用 Promise.race 实现超时控制
    // Promise.race 会返回最先完成的 Promise 的结果
    // 如果导出操作在 30 秒内完成，返回导出结果
    // 如果超时 Promise 先完成（30秒到了），抛出超时异常
    const result = await Promise.race([
      exportPromise,
      this.createTimeoutPromise(),
    ]);

    return result;
  }

  /**
   * 导出为 Word (.docx) 格式
   *
   * 流程：
   * 1. 解析 Tiptap JSON 内容为段落列表
   * 2. 在文档开头添加标题（H1 级别）
   * 3. 使用 docx 库的 Packer 将文档打包为 Buffer
   *
   * @param document - 包含标题和内容的文档对象
   * @returns 生成的 .docx 文件 Buffer
   */
  async exportToDocx(document: {
    title: string;
    content: string;
  }): Promise<Buffer> {
    // 步骤1：解析 Tiptap JSON 内容为 docx 段落
    const contentParagraphs = this.parseContentToDocxParagraphs(
      document.content,
    );

    // 步骤2：创建 docx 文档对象
    // sections 是 Word 文档的"节"，一般文档只有一个节
    // children 是节中的内容（段落、表格等）
    const doc = new DocxDocument({
      sections: [
        {
          children: [
            // 文档标题作为第一个段落（H1 级别）
            new Paragraph({
              text: document.title,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            // 标题后添加一个空行作为间隔
            new Paragraph({ text: '' }),
            // 正文内容段落
            ...contentParagraphs,
          ],
        },
      ],
    });

    // 步骤3：使用 Packer 将文档对象打包为 Buffer
    // Packer.toBuffer() 是异步操作，返回 Node.js Buffer
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }

  /**
   * 导出为 PDF 格式
   *
   * 流程：
   * 1. 创建 PDFDocument 实例
   * 2. 添加文档标题
   * 3. 解析 Tiptap JSON 内容并渲染到 PDF
   * 4. 收集所有数据块并合并为 Buffer
   *
   * @param document - 包含标题和内容的文档对象
   * @returns 生成的 .pdf 文件 Buffer
   */
  async exportToPdf(document: {
    title: string;
    content: string;
  }): Promise<Buffer> {
    // 返回一个 Promise，因为 PDFKit 使用流式 API
    return new Promise<Buffer>((resolve, reject) => {
      try {
        // 步骤1：创建 PDF 文档实例
        // bufferPages: true 允许在内存中操作页面
        const doc = new PDFDocument({
          bufferPages: true,
          size: 'A4',
          margins: { top: 72, bottom: 72, left: 72, right: 72 },
        });

        // 步骤2：收集 PDF 数据块
        // PDFKit 使用 Node.js Stream API，数据以 chunk 形式输出
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          // 所有数据块收集完毕后，合并为一个完整的 Buffer
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on('error', (err: Error) => reject(err));

        // 步骤3：添加文档标题（居中、大字号）
        doc.fontSize(24).text(document.title, { align: 'center' });
        // 标题后添加空行
        doc.moveDown(1.5);

        // 步骤4：解析内容并渲染到 PDF
        this.renderContentToPdf(doc, document.content);

        // 步骤5：结束文档（触发 'end' 事件）
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 检测文档内容是否为空
   *
   * 判断逻辑：
   * - 内容为 null/undefined/空字符串 → 空
   * - 内容为空 JSON 对象 {} → 空
   * - 内容为 Tiptap 空文档（只有 doc 节点，无子节点或子节点全为空段落）→ 空
   *
   * @param content - 文档内容字符串（Tiptap JSON 格式）
   * @returns true 表示内容为空，false 表示有内容
   */
  private isContentEmpty(content: string): boolean {
    // 情况1：内容为空字符串或仅包含空白字符
    if (!content || content.trim().length === 0) {
      return true;
    }

    // 情况2：尝试解析为 JSON，检查是否为空文档结构
    try {
      const parsed = JSON.parse(content) as TiptapNode;

      // 空对象 {}
      if (!parsed || Object.keys(parsed).length === 0) {
        return true;
      }

      // Tiptap 文档结构：{ type: 'doc', content: [...] }
      if (parsed.type === 'doc') {
        // 没有 content 数组或 content 为空数组
        if (!parsed.content || parsed.content.length === 0) {
          return true;
        }

        // 检查所有子节点是否都是空段落（没有文本内容）
        const hasContent = parsed.content.some((node) =>
          this.nodeHasText(node),
        );
        return !hasContent;
      }

      return false;
    } catch {
      // 如果不是有效 JSON，当作纯文本处理
      // 纯文本不为空则认为有内容
      return false;
    }
  }

  /**
   * 递归检查节点是否包含文本内容
   *
   * @param node - Tiptap 节点
   * @returns true 表示节点包含文本
   */
  private nodeHasText(node: TiptapNode): boolean {
    // text 类型节点：检查 text 字段是否有内容
    if (node.type === 'text' && node.text && node.text.trim().length > 0) {
      return true;
    }

    // 递归检查子节点
    if (node.content && node.content.length > 0) {
      return node.content.some((child) => this.nodeHasText(child));
    }

    return false;
  }

  /**
   * 解析 Tiptap JSON 内容为 docx 段落列表
   *
   * 支持的节点类型：
   * - paragraph：普通段落
   * - heading：标题（H1-H4）
   * - bulletList：无序列表
   * - orderedList：有序列表
   * - text：文本节点（支持 bold、italic、underline 标记）
   *
   * @param content - Tiptap JSON 内容字符串
   * @returns docx Paragraph 对象数组
   */
  private parseContentToDocxParagraphs(content: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    try {
      const parsed = JSON.parse(content) as TiptapNode;

      // Tiptap 文档结构：{ type: 'doc', content: [...] }
      const nodes = parsed.type === 'doc' ? (parsed.content || []) : [parsed];

      for (const node of nodes) {
        const nodeParagraphs = this.convertNodeToDocxParagraphs(node);
        paragraphs.push(...nodeParagraphs);
      }
    } catch {
      // 如果 JSON 解析失败，将内容作为纯文本处理
      if (content && content.trim().length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: content })],
          }),
        );
      }
    }

    return paragraphs;
  }

  /**
   * 将单个 Tiptap 节点转换为 docx 段落
   *
   * @param node - Tiptap 节点
   * @returns docx Paragraph 对象数组（一个节点可能生成多个段落，如列表）
   */
  private convertNodeToDocxParagraphs(node: TiptapNode): Paragraph[] {
    switch (node.type) {
      case 'paragraph':
        return [this.createDocxParagraph(node)];

      case 'heading':
        return [this.createDocxHeading(node)];

      case 'bulletList':
      case 'orderedList':
        return this.createDocxList(node);

      default:
        // 未知节点类型，尝试提取文本内容
        if (node.content) {
          return node.content.flatMap((child) =>
            this.convertNodeToDocxParagraphs(child),
          );
        }
        return [];
    }
  }

  /**
   * 创建 docx 普通段落
   *
   * @param node - paragraph 类型的 Tiptap 节点
   * @returns docx Paragraph 对象
   */
  private createDocxParagraph(node: TiptapNode): Paragraph {
    const textRuns = this.extractTextRuns(node.content || []);
    return new Paragraph({ children: textRuns });
  }

  /**
   * 创建 docx 标题段落
   *
   * @param node - heading 类型的 Tiptap 节点
   * @returns docx Paragraph 对象（带标题级别）
   */
  private createDocxHeading(node: TiptapNode): Paragraph {
    // Tiptap 标题的 level 存储在 attrs.level 中（1-4）
    const level = (node.attrs?.level as number) || 1;

    // 将 Tiptap 的 level 映射为 docx 的 HeadingLevel
    const headingLevelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
    };

    const textRuns = this.extractTextRuns(node.content || []);
    return new Paragraph({
      children: textRuns,
      heading: headingLevelMap[level] || HeadingLevel.HEADING_1,
    });
  }

  /**
   * 创建 docx 列表段落
   *
   * @param node - bulletList 或 orderedList 类型的 Tiptap 节点
   * @returns docx Paragraph 对象数组（每个列表项一个段落）
   */
  private createDocxList(node: TiptapNode): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const listItems = node.content || [];

    // 遍历列表项（listItem 节点）
    for (let i = 0; i < listItems.length; i++) {
      const listItem = listItems[i];
      // listItem 的 content 通常包含一个 paragraph 节点
      const itemContent = listItem.content || [];

      for (const itemNode of itemContent) {
        if (itemNode.type === 'paragraph') {
          const textRuns = this.extractTextRuns(itemNode.content || []);

          // 为列表项添加前缀标记
          // 无序列表用 "• "，有序列表用 "1. "、"2. " 等
          const prefix =
            node.type === 'bulletList' ? '• ' : `${i + 1}. `;

          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: prefix }),
                ...textRuns,
              ],
            }),
          );
        }
      }
    }

    return paragraphs;
  }

  /**
   * 从 Tiptap 内容节点数组中提取 TextRun 对象
   *
   * 处理文本格式标记（bold、italic、underline）
   *
   * @param nodes - Tiptap 内容节点数组（通常是 text 类型节点）
   * @returns docx TextRun 对象数组
   */
  private extractTextRuns(nodes: TiptapNode[]): TextRun[] {
    const textRuns: TextRun[] = [];

    for (const node of nodes) {
      if (node.type === 'text' && node.text) {
        // 检查文本的格式标记
        const marks = node.marks || [];
        const isBold = marks.some((mark) => mark.type === 'bold');
        const isItalic = marks.some((mark) => mark.type === 'italic');
        const isUnderline = marks.some((mark) => mark.type === 'underline');

        textRuns.push(
          new TextRun({
            text: node.text,
            bold: isBold,
            italics: isItalic,
            underline: isUnderline ? {} : undefined,
          }),
        );
      }
    }

    return textRuns;
  }

  /**
   * 将 Tiptap JSON 内容渲染到 PDF 文档
   *
   * @param doc - PDFKit 文档实例
   * @param content - Tiptap JSON 内容字符串
   */
  private renderContentToPdf(doc: PDFKit.PDFDocument, content: string): void {
    try {
      const parsed = JSON.parse(content) as TiptapNode;
      const nodes = parsed.type === 'doc' ? (parsed.content || []) : [parsed];

      for (const node of nodes) {
        this.renderNodeToPdf(doc, node);
      }
    } catch {
      // JSON 解析失败，将内容作为纯文本渲染
      if (content && content.trim().length > 0) {
        doc.fontSize(12).text(content);
      }
    }
  }

  /**
   * 将单个 Tiptap 节点渲染到 PDF
   *
   * @param doc - PDFKit 文档实例
   * @param node - Tiptap 节点
   */
  private renderNodeToPdf(doc: PDFKit.PDFDocument, node: TiptapNode): void {
    switch (node.type) {
      case 'paragraph':
        this.renderParagraphToPdf(doc, node);
        break;

      case 'heading':
        this.renderHeadingToPdf(doc, node);
        break;

      case 'bulletList':
      case 'orderedList':
        this.renderListToPdf(doc, node);
        break;

      default:
        // 未知节点类型，尝试递归渲染子节点
        if (node.content) {
          for (const child of node.content) {
            this.renderNodeToPdf(doc, child);
          }
        }
        break;
    }
  }

  /**
   * 渲染段落到 PDF
   *
   * @param doc - PDFKit 文档实例
   * @param node - paragraph 类型节点
   */
  private renderParagraphToPdf(
    doc: PDFKit.PDFDocument,
    node: TiptapNode,
  ): void {
    const textParts = this.extractTextParts(node.content || []);

    if (textParts.length === 0) {
      // 空段落：添加一个空行
      doc.moveDown(0.5);
      return;
    }

    // 渲染段落中的每个文本片段
    doc.fontSize(12);
    for (let i = 0; i < textParts.length; i++) {
      const part = textParts[i];
      // 根据格式标记设置字体
      const font = this.getPdfFont(part.bold, part.italic);
      doc.font(font);

      // continued: true 表示后续文本在同一行继续
      // 最后一个片段不设置 continued，让 PDFKit 自动换行
      const isLast = i === textParts.length - 1;
      doc.text(part.text, { continued: !isLast });
    }

    doc.moveDown(0.3);
  }

  /**
   * 渲染标题到 PDF
   *
   * @param doc - PDFKit 文档实例
   * @param node - heading 类型节点
   */
  private renderHeadingToPdf(
    doc: PDFKit.PDFDocument,
    node: TiptapNode,
  ): void {
    const level = (node.attrs?.level as number) || 1;

    // 根据标题级别设置字号（级别越高字号越大）
    const fontSizeMap: Record<number, number> = {
      1: 22,
      2: 18,
      3: 16,
      4: 14,
    };
    const fontSize = fontSizeMap[level] || 14;

    // 提取标题文本
    const text = this.extractPlainText(node.content || []);

    doc.fontSize(fontSize).font('Helvetica-Bold').text(text);
    doc.moveDown(0.5);
  }

  /**
   * 渲染列表到 PDF
   *
   * @param doc - PDFKit 文档实例
   * @param node - bulletList 或 orderedList 类型节点
   */
  private renderListToPdf(doc: PDFKit.PDFDocument, node: TiptapNode): void {
    const listItems = node.content || [];

    for (let i = 0; i < listItems.length; i++) {
      const listItem = listItems[i];
      const itemContent = listItem.content || [];

      for (const itemNode of itemContent) {
        if (itemNode.type === 'paragraph') {
          const text = this.extractPlainText(itemNode.content || []);
          // 无序列表用 "• "，有序列表用 "1. " 等
          const prefix =
            node.type === 'bulletList' ? '• ' : `${i + 1}. `;

          doc.fontSize(12).font('Helvetica').text(`${prefix}${text}`, {
            indent: 20,
          });
        }
      }
    }

    doc.moveDown(0.3);
  }

  /**
   * 从节点数组中提取带格式信息的文本片段
   *
   * @param nodes - Tiptap 内容节点数组
   * @returns 带格式信息的文本片段数组
   */
  private extractTextParts(
    nodes: TiptapNode[],
  ): Array<{ text: string; bold: boolean; italic: boolean }> {
    const parts: Array<{ text: string; bold: boolean; italic: boolean }> = [];

    for (const node of nodes) {
      if (node.type === 'text' && node.text) {
        const marks = node.marks || [];
        parts.push({
          text: node.text,
          bold: marks.some((m) => m.type === 'bold'),
          italic: marks.some((m) => m.type === 'italic'),
        });
      }
    }

    return parts;
  }

  /**
   * 从节点数组中提取纯文本（不含格式信息）
   *
   * @param nodes - Tiptap 内容节点数组
   * @returns 拼接后的纯文本字符串
   */
  private extractPlainText(nodes: TiptapNode[]): string {
    return nodes
      .filter((node) => node.type === 'text' && node.text)
      .map((node) => node.text || '')
      .join('');
  }

  /**
   * 根据格式标记获取 PDF 字体名称
   *
   * PDFKit 内置字体：
   * - Helvetica：普通
   * - Helvetica-Bold：加粗
   * - Helvetica-Oblique：斜体
   * - Helvetica-BoldOblique：加粗+斜体
   *
   * @param bold - 是否加粗
   * @param italic - 是否斜体
   * @returns PDFKit 字体名称
   */
  private getPdfFont(bold: boolean, italic: boolean): string {
    if (bold && italic) return 'Helvetica-BoldOblique';
    if (bold) return 'Helvetica-Bold';
    if (italic) return 'Helvetica-Oblique';
    return 'Helvetica';
  }

  /**
   * 创建超时 Promise
   *
   * 用于 Promise.race 实现超时控制。
   * 30 秒后 reject，抛出 GatewayTimeoutException。
   *
   * 为什么用 Promise.race？
   * - Promise.race 接收多个 Promise，返回最先完成的那个的结果
   * - 如果导出操作在 30 秒内完成，race 返回导出结果
   * - 如果 30 秒到了导出还没完成，race 返回超时 Promise 的 reject
   * - 这样就实现了"最多等 30 秒"的效果
   *
   * @returns 永远不会 resolve 的 Promise（只会在超时后 reject）
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new GatewayTimeoutException('导出超时，请重试'),
        );
      }, EXPORT_TIMEOUT_MS);
    });
  }
}
