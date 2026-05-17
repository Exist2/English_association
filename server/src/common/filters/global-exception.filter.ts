/**
 * 全局异常过滤器
 *
 * 用途：捕获应用中所有未处理的异常，将其转换为统一的错误响应格式。
 * 这样前端收到的错误响应结构始终一致：{ code, message, details? }
 *
 * 为什么需要这个？
 * - NestJS 默认的错误响应格式不统一（有时是 { message, statusCode }，有时是字符串）
 * - 我们需要统一格式，方便前端统一处理错误
 * - 同时避免将内部错误细节（如数据库错误、堆栈信息）暴露给客户端
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 统一错误响应接口
 * @description 所有 API 错误都遵循此格式返回
 */
export interface ErrorResponse {
  /** 错误码，如 VALIDATION_ERROR、UNAUTHORIZED、INTERNAL_ERROR 等 */
  code: string;
  /** 用户可读的错误信息 */
  message: string;
  /** 可选的详细信息，如字段级验证错误 */
  details?: object;
}

/**
 * 全局异常过滤器
 * @description 使用 @Catch() 不带参数表示捕获所有类型的异常
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  // Logger 是 NestJS 内置的日志工具，用于在控制台输出带格式的日志
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * 异常处理方法
   * @param exception - 捕获到的异常对象（可能是 HttpException 或普通 Error）
   * @param host - ArgumentsHost 提供了获取请求/响应对象的方法
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    // 切换到 HTTP 上下文，获取 Express 的 Request 和 Response 对象
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 根据异常类型确定 HTTP 状态码和错误信息
    let status: number;
    let errorResponse: ErrorResponse;

    if (exception instanceof HttpException) {
      // 如果是 NestJS 的 HttpException（包括业务异常），提取状态码和响应体
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        // 简单字符串错误信息
        errorResponse = {
          code: this.getErrorCode(status),
          message: exceptionResponse,
        };
      } else if (typeof exceptionResponse === 'object') {
        // 对象形式的错误响应（如 class-validator 的验证错误）
        const responseObj = exceptionResponse as Record<string, unknown>;
        errorResponse = {
          code: (responseObj['code'] as string) || this.getErrorCode(status),
          message:
            (responseObj['message'] as string) ||
            exception.message ||
            '请求处理失败',
          details: responseObj['details'] as object | undefined,
        };

        // 处理 class-validator 返回的数组形式的 message
        if (Array.isArray(responseObj['message'])) {
          errorResponse.message = '参数校验失败';
          errorResponse.details = {
            errors: responseObj['message'],
          };
        }
      } else {
        errorResponse = {
          code: this.getErrorCode(status),
          message: exception.message || '请求处理失败',
        };
      }
    } else {
      // 未知异常（如代码 bug 导致的 TypeError 等），统一返回 500
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        code: 'INTERNAL_ERROR',
        message: '系统异常，请稍后重试',
      };

      // 将未知异常的详细信息记录到服务器日志（不暴露给客户端）
      this.logger.error(
        `未处理异常: ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // 发送统一格式的错误响应
    response.status(status).json(errorResponse);
  }

  /**
   * 根据 HTTP 状态码返回对应的错误码字符串
   * @param status - HTTP 状态码
   * @returns 错误码字符串
   */
  private getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'CONTENT_TOO_LARGE',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };
    return codeMap[status] || 'UNKNOWN_ERROR';
  }
}
