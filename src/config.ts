// 运行时配置：从 URL 查询参数读取 runtime 地址与令牌，便于一份构建连不同生命。
// 例： http://localhost:5173/?runtime=http://localhost:3001&token=xxx
const params = new URLSearchParams(location.search);

export const RUNTIME_URL = params.get('runtime') || 'http://localhost:3000';
export const RUNTIME_TOKEN = params.get('token') || undefined;

export const VIEW = {
  width: 1280,
  height: 720,
};
