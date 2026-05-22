/**
 * API 接口文件自动生成脚本
 *
 * 用途：
 * 从后端 Swagger JSON 文档解析接口信息，按模块生成简洁的 TypeScript 文件。
 * 每个模块生成 2 个文件：
 *   - {module}.types.ts — 请求参数和响应的类型定义
 *   - {module}.ts       — API 调用函数（基于项目现有的 apiClient）
 *
 * 使用方式：
 *   npm run gen:api                                    # 默认 http://localhost:3000/api-docs-json
 *   npm run gen:api -- --url http://xxx/api-docs-json  # 自定义地址
 *
 * ⚠️ generated/ 目录下的文件会被完全覆盖，请勿手动修改！
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// 配置：Swagger Tag → 模块文件名 + API 对象名
// ============================================
const TAG_MAP = {
  '认证模块': { fileName: 'auth', apiName: 'authApi' },
  '文档模块': { fileName: 'document', apiName: 'documentApi' },
  '联想模块': { fileName: 'association', apiName: 'associationApi' },
  '导出模块': { fileName: 'export', apiName: 'exportApi' },
  '设置模块': { fileName: 'settings', apiName: 'settingsApi' },
};

// ============================================
// 工具函数
// ============================================

function getSwaggerUrl() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--url');
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return 'http://localhost:3000/api-docs-json';
}

function cleanOutputDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.ts')) fs.unlinkSync(path.join(dir, file));
  }
}

/**
 * 将 Swagger schema 的 $ref 或 inline 定义转为 TypeScript 类型字符串
 */
function schemaToType(schema, schemas, indent = '  ') {
  if (!schema) return 'unknown';

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    return refName;
  }

  if (schema.enum) {
    return schema.enum.map((v) => `'${v}'`).join(' | ');
  }

  if (schema.type === 'string') return 'string';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'boolean') return 'boolean';

  if (schema.type === 'array') {
    const itemType = schemaToType(schema.items, schemas, indent);
    return `${itemType}[]`;
  }

  if (schema.type === 'object' || schema.properties) {
    const props = schema.properties || {};
    const required = schema.required || [];
    const lines = [];
    for (const [key, prop] of Object.entries(props)) {
      const optional = required.includes(key) ? '' : '?';
      const type = schemaToType(prop, schemas, indent + '  ');
      if (prop.description) {
        lines.push(`${indent}/** ${prop.description} */`);
      }
      lines.push(`${indent}${key}${optional}: ${type};`);
    }
    return `{\n${lines.join('\n')}\n${indent.slice(2)}}`;
  }

  return 'unknown';
}

/**
 * 将 DTO schema 展开为接口属性列表
 */
function generateInterfaceBody(schema, schemas) {
  if (!schema) return '';

  // 处理 $ref
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    const refSchema = schemas[refName];
    if (refSchema) return generateInterfaceBody(refSchema, schemas);
    return '';
  }

  const props = schema.properties || {};
  const required = schema.required || [];
  const lines = [];

  for (const [key, prop] of Object.entries(props)) {
    const optional = required.includes(key) ? '' : '?';
    const type = schemaToType(prop, schemas);

    if (prop.description) {
      lines.push(`  /** ${prop.description} */`);
    }
    lines.push(`  ${key}${optional}: ${type};`);
  }

  return lines.join('\n');
}

/**
 * 从 operationId 生成简洁的方法名
 * 例如：AuthController_login → login, DocumentController_findAll → findAll
 */
function toMethodName(operationId) {
  // operationId 格式为 "XxxController_methodName"
  const parts = operationId.split('_');
  if (parts.length >= 2) {
    // 取下划线后面的部分作为方法名
    return parts.slice(1).join('_');
  }
  return operationId;
}

/**
 * 判断路径中是否有路径参数
 */
function getPathParams(pathStr) {
  const matches = pathStr.match(/\{(\w+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/[{}]/g, ''));
}

/**
 * 生成响应类型
 */
function generateResponseType(responses, schemas) {
  // 优先取 200 或 201 的响应
  const successResponse = responses['200'] || responses['201'];
  if (!successResponse) return 'void';

  const content = successResponse.content;
  if (!content) return 'void';

  const jsonContent = content['application/json'];
  if (!jsonContent || !jsonContent.schema) return 'void';

  return schemaToType(jsonContent.schema, schemas);
}

// ============================================
// 主逻辑
// ============================================

async function main() {
  const swaggerUrl = getSwaggerUrl();
  const outputDir = path.resolve(__dirname, '../src/services/generated');

  console.log(`📡 正在从 ${swaggerUrl} 获取 Swagger 文档...`);

  // 拉取 Swagger JSON
  let swaggerDoc;
  try {
    const response = await fetch(swaggerUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    swaggerDoc = await response.json();
  } catch (error) {
    console.error(`❌ 获取 Swagger 文档失败: ${error.message}`);
    console.error('   确保后端已启动: cd server && npm run start:dev');
    process.exit(1);
  }

  console.log(`📁 输出目录: ${outputDir}`);
  console.log('🧹 清空旧文件...');
  cleanOutputDir(outputDir);

  const paths = swaggerDoc.paths || {};
  const schemas = swaggerDoc.components?.schemas || {};

  // 按 tag 分组收集接口
  const moduleMap = {}; // { tag: [{ method, path, operationId, ... }] }

  for (const [pathStr, methods] of Object.entries(paths)) {
    for (const [httpMethod, operation] of Object.entries(methods)) {
      const tags = operation.tags || ['默认'];
      const tag = tags[0];

      if (!moduleMap[tag]) moduleMap[tag] = [];
      moduleMap[tag].push({
        httpMethod: httpMethod.toUpperCase(),
        path: pathStr,
        operationId: operation.operationId,
        summary: operation.summary || '',
        description: operation.description || '',
        parameters: operation.parameters || [],
        requestBody: operation.requestBody,
        responses: operation.responses || {},
        security: operation.security,
      });
    }
  }

  // 为每个模块生成文件
  for (const [tag, endpoints] of Object.entries(moduleMap)) {
    const config = TAG_MAP[tag];
    if (!config) {
      console.warn(`⚠️  未知的 tag "${tag}"，跳过`);
      continue;
    }

    const { fileName, apiName } = config;

    // 收集该模块用到的类型
    const usedSchemas = new Set();

    for (const ep of endpoints) {
      // 收集请求体引用的 schema
      if (ep.requestBody?.content?.['application/json']?.schema?.$ref) {
        usedSchemas.add(ep.requestBody.content['application/json'].schema.$ref.split('/').pop());
      }
      // 收集 query/path 参数引用的 schema
      for (const param of ep.parameters) {
        if (param.schema?.$ref) {
          usedSchemas.add(param.schema.$ref.split('/').pop());
        }
      }
    }

    // ========== 生成 types 文件 ==========
    const typesLines = [
      '/**',
      ` * ${tag} - 类型定义`,
      ' *',
      ' * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！',
      ' */',
      '',
    ];

    // 输出该模块用到的 DTO 接口
    for (const schemaName of usedSchemas) {
      const schema = schemas[schemaName];
      if (!schema) continue;

      typesLines.push(`/** ${schema.description || schemaName} */`);
      typesLines.push(`export interface ${schemaName} {`);
      typesLines.push(generateInterfaceBody(schema, schemas));
      typesLines.push('}');
      typesLines.push('');
    }

    // 为每个接口生成响应类型接口
    for (const ep of endpoints) {
      const methodName = toMethodName(ep.operationId);
      const responseName = `${capitalize(methodName)}Response`;
      const successResp = ep.responses['200'] || ep.responses['201'];

      if (!successResp?.content?.['application/json']?.schema) {
        // 没有 JSON 响应体（如文件下载返回二进制流）
        // 生成 Blob 类型别名
        typesLines.push(`/** ${ep.summary} - 响应（二进制文件流） */`);
        typesLines.push(`export type ${responseName} = Blob;`);
        typesLines.push('');
        continue;
      }

      const respSchema = successResp.content['application/json'].schema;

      // 如果是 $ref，直接 export type 别名
      if (respSchema.$ref) {
        const refName = respSchema.$ref.split('/').pop();
        typesLines.push(`export type ${responseName} = ${refName};`);
        typesLines.push('');
        continue;
      }

      // inline object
      typesLines.push(`/** ${ep.summary} - 响应 */`);
      typesLines.push(`export interface ${responseName} {`);
      typesLines.push(generateInterfaceBody(respSchema, schemas));
      typesLines.push('}');
      typesLines.push('');
    }

    fs.writeFileSync(
      path.join(outputDir, `${fileName}.types.ts`),
      typesLines.join('\n'),
      'utf-8'
    );

    // ========== 生成 API 调用文件 ==========
    const apiLines = [
      '/**',
      ` * ${tag} - API 调用`,
      ' *',
      ' * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！',
      ' */',
      '',
      `import { apiClient } from '../api-client';`,
    ];

    // 收集需要 import 的类型
    const importTypes = [];
    for (const schemaName of usedSchemas) {
      importTypes.push(schemaName);
    }
    for (const ep of endpoints) {
      const methodName = toMethodName(ep.operationId);
      importTypes.push(`${capitalize(methodName)}Response`);
    }

    if (importTypes.length > 0) {
      apiLines.push(`import type { ${importTypes.join(', ')} } from './${fileName}.types';`);
    }

    apiLines.push('');
    apiLines.push(`export const ${apiName} = {`);

    for (const ep of endpoints) {
      const methodName = toMethodName(ep.operationId);
      const responseName = `${capitalize(methodName)}Response`;
      const pathParams = getPathParams(ep.path);
      const hasBody = !!ep.requestBody;
      const hasQuery = ep.parameters.some((p) => p.in === 'query');

      // 构建函数参数
      const fnParams = [];
      if (pathParams.length > 0) {
        fnParams.push(...pathParams.map((p) => `${p}: string`));
      }
      if (hasBody) {
        const bodyRef = ep.requestBody?.content?.['application/json']?.schema?.$ref;
        const bodyType = bodyRef ? bodyRef.split('/').pop() : 'Record<string, unknown>';
        fnParams.push(`data: ${bodyType}`);
      }
      if (hasQuery) {
        // 构建 query 参数类型
        const queryParams = ep.parameters.filter((p) => p.in === 'query');
        const queryType = queryParams
          .map((p) => {
            const type = p.schema?.type === 'integer' || p.schema?.type === 'number' ? 'number' : 'string';
            return `${p.name}${p.required ? '' : '?'}: ${type}`;
          })
          .join('; ');
        fnParams.push(`params?: { ${queryType} }`);
      }

      // 构建 axios 调用路径（替换路径参数）
      let axiosPath = ep.path.replace('/api', ''); // apiClient 已有 /api 前缀
      for (const p of pathParams) {
        axiosPath = axiosPath.replace(`{${p}}`, `\${${p}}`);
      }

      // JSDoc
      apiLines.push(`  /**`);
      apiLines.push(`   * ${ep.summary}`);
      if (ep.description && ep.description !== ep.summary) {
        apiLines.push(`   * ${ep.description}`);
      }
      apiLines.push(`   */`);

      // 函数体
      const paramsStr = fnParams.length > 0 ? fnParams.join(', ') : '';
      const httpMethod = ep.httpMethod.toLowerCase();

      if (httpMethod === 'get') {
        const configArg = hasQuery ? ', { params }' : '';
        apiLines.push(`  ${methodName}(${paramsStr}) {`);
        apiLines.push(`    return apiClient.${httpMethod}<${responseName}>(\`${axiosPath}\`${configArg});`);
        apiLines.push(`  },`);
      } else {
        const bodyArg = hasBody ? ', data' : '';
        apiLines.push(`  ${methodName}(${paramsStr}) {`);
        apiLines.push(`    return apiClient.${httpMethod}<${responseName}>(\`${axiosPath}\`${bodyArg});`);
        apiLines.push(`  },`);
      }
      apiLines.push('');
    }

    apiLines.push('};');
    apiLines.push('');

    fs.writeFileSync(
      path.join(outputDir, `${fileName}.ts`),
      apiLines.join('\n'),
      'utf-8'
    );

    console.log(`  ✅ ${fileName}.types.ts + ${fileName}.ts`);
  }

  // ========== 生成 index.ts ==========
  const indexLines = [
    '/**',
    ' * API 模块统一导出',
    ' *',
    ' * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！',
    ' */',
    '',
  ];

  for (const [, config] of Object.entries(TAG_MAP)) {
    indexLines.push(`export { ${config.apiName} } from './${config.fileName}';`);
    indexLines.push(`export type * from './${config.fileName}.types';`);
  }
  indexLines.push('');

  fs.writeFileSync(path.join(outputDir, 'index.ts'), indexLines.join('\n'), 'utf-8');
  console.log('  ✅ index.ts');
  console.log('');
  console.log('🎉 生成完成！');
}

// ============================================
// 辅助函数
// ============================================

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

main();
