import { withBase } from '../basePath'

/** Resolve private tracks through the existing ownership-checked signing route. */
export async function downloadStudioTrack(url: string, title: string, imageUrl?: string) {
  let audioUrl = url
  if (!/^https?:\/\//i.test(audioUrl)) {
    const signed = await fetch(withBase(`/api/tracks/signed-url?file_path=${encodeURIComponent(audioUrl)}`))
    const data = await signed.json()
    if (!signed.ok || !data.signedUrl) throw new Error('음원 접근 권한을 확인할 수 없습니다.')
    audioUrl = data.signedUrl
  }
  const params = new URLSearchParams({ url: audioUrl, filename: title })
  if (imageUrl) params.set('image', imageUrl)
  const response = await fetch(withBase(`/api/download?${params}`))
  if (!response.ok) throw new Error('음원을 다운로드하지 못했습니다. 다시 시도해 주세요.')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = /\.mp3$/i.test(title) ? title : `${title}.mp3`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Allow the browser to start consuming the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}
