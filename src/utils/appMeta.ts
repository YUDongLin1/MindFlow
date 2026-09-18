import pkg from '../../package.json'

/** 应用元信息：版本号以 package.json 为唯一事实源 */
export const APP_VERSION: string = pkg.version
export const APP_NAME = 'MindFlow 智流日志'
/** 构建日期：由 vite define 在构建时注入 __BUILD_DATE__，未注入时回退到当前日期 */
export const BUILD_DATE: string =
  typeof __BUILD_DATE__ !== 'undefined' && __BUILD_DATE__
    ? __BUILD_DATE__
    : new Date().toISOString().slice(0, 10)
