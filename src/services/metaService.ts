/**
 * 元数据服务：自动获取时间、地点、天气
 * 隐私优先：定位需用户授权，失败优雅降级
 */

export interface LocationInfo {
  city: string
  latitude: number
  longitude: number
}

export interface WeatherInfo {
  description: string
  temperature: number
  icon: string
}

export interface CurrentMeta {
  time: string
  location: LocationInfo | null
  weather: WeatherInfo | null
}

// 反向地理编码：经纬度 → 城市名
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) throw new Error('geocode failed')
    const data = await res.json()
    return data.address?.city || data.address?.town || data.address?.county || data.address?.state || '未知位置'
  } catch {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`
  }
}

// 获取位置
export async function getCurrentLocation(): Promise<LocationInfo | null> {
  if (!navigator.geolocation) return null

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const city = await reverseGeocode(latitude, longitude)
        resolve({ city, latitude, longitude })
      },
      () => resolve(null),  // 用户拒绝或失败
      { timeout: 8000, maximumAge: 300000 }  // 5 分钟缓存
    )
  })
}

// 获取天气（基于 wttr.in 免费 API）
export async function getWeather(lat: number, lon: number): Promise<WeatherInfo | null> {
  try {
    const res = await fetch(
      `https://wttr.in/${lat},${lon}?format=j1`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) throw new Error('weather failed')
    const data = await res.json()
    const current = data.current_condition?.[0]
    if (!current) return null

    const desc = current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '未知'
    const temp = parseInt(current.temp_C, 10) || 0

    // 简化天气图标映射
    const code = parseInt(current.weatherCode, 10)
    let icon = '☀️'
    if (code >= 200 && code < 300) icon = '⛈️'
    else if (code >= 300 && code < 500) icon = '🌧️'
    else if (code >= 500 && code < 600) icon = '🌧️'
    else if (code >= 600 && code < 700) icon = '❄️'
    else if (code >= 700 && code < 800) icon = '🌫️'
    else if (code === 800) icon = '☀️'
    else if (code === 801) icon = '⛅'
    else if (code > 801) icon = '☁️'

    return { description: desc, temperature: temp, icon }
  } catch {
    return null
  }
}

// 获取完整元数据
export async function getCurrentMeta(): Promise<CurrentMeta> {
  const now = new Date()
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  const location = await getCurrentLocation()
  let weather: WeatherInfo | null = null

  if (location) {
    weather = await getWeather(location.latitude, location.longitude)
  }

  return { time, location, weather }
}
