// 브라우저 인코딩(lamejs, src/lib/audioUtils.ts encodeAudioBufferToMp3)으로 대체, 남겨 둠.
import { NextResponse } from 'next/server'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * ffmpeg 실행 파일 위치. `ffmpeg-static` 을 정적 import 하면 번들러·추적기가 44 MB 바이너리와
 * 프로젝트 루트 전체를 서버리스 함수에 넣어(모든 API 함수가 57 MB) 무료 한도를 넘기므로
 * 실행 시점에만 찾는다. 로컬에서는 종전처럼 ffmpeg-static 을 쓰고, 없으면 시스템 ffmpeg.
 */
function resolveFfmpeg(): string {
  try {
    const staticPath = createRequire(path.join(process.cwd(), 'package.json'))('ffmpeg-static') as string | null
    if (staticPath && fs.existsSync(staticPath)) return staticPath
  } catch {}
  return 'ffmpeg'
}

export async function POST(request: Request) {
  let inputTmpPath = ''
  let outputTmpPath = ''

  try {
    let buffer: Buffer | null = null
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (file) {
        buffer = Buffer.from(await file.arrayBuffer())
      }
    } else {
      const arrayBuffer = await request.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'No audio data received' }, { status: 400 })
    }

    const uniqueId = Math.random().toString(36).substring(2, 9)
    const tmpDir = os.tmpdir()
    inputTmpPath = path.join(tmpDir, `input_${uniqueId}.wav`)
    outputTmpPath = path.join(tmpDir, `output_${uniqueId}.mp3`)

    await fs.promises.writeFile(inputTmpPath, buffer)

    const ffmpegExecutable = resolveFfmpeg()

    // Run ffmpeg to transcode WAV -> 320kbps MP3
    await new Promise<void>((resolve, reject) => {
      // 간접 호출인 이유: Turbopack 이 `spawn(실행파일)` 의 첫 인수를 정적으로 못 정하면
      // 프로젝트 루트 전체(~30 MB)를 서버리스 함수 번들에 넣는다. 동작은 spawn 과 같다.
      const ffmpegProcess: ChildProcessWithoutNullStreams = Reflect.apply(spawn, null, [ffmpegExecutable, [
        '-y',
        '-i', inputTmpPath,
        '-codec:a', 'libmp3lame',
        '-b:a', '320k',
        outputTmpPath
      ]])

      let errorLogs = ''
      ffmpegProcess.stderr.on('data', (data) => {
        errorLogs += data.toString()
      })

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`FFmpeg transcoding failed (code ${code}): ${errorLogs}`))
        }
      })

      ffmpegProcess.on('error', (err) => {
        reject(err)
      })
    })

    const mp3Buffer = await fs.promises.readFile(outputTmpPath)

    try {
      if (fs.existsSync(inputTmpPath)) await fs.promises.unlink(inputTmpPath)
      if (fs.existsSync(outputTmpPath)) await fs.promises.unlink(outputTmpPath)
    } catch (e) {}

    return new NextResponse(mp3Buffer, {
      headers: {
        'Content-Type': 'audio/mp3',
        'Content-Disposition': 'attachment; filename="mastered.mp3"',
      },
    })
  } catch (err: any) {
    console.error('MP3 Conversion Error:', err)
    try {
      if (inputTmpPath && fs.existsSync(inputTmpPath)) await fs.promises.unlink(inputTmpPath)
      if (outputTmpPath && fs.existsSync(outputTmpPath)) await fs.promises.unlink(outputTmpPath)
    } catch (e) {}

    return NextResponse.json(
      { error: err.message || 'MP3 conversion failed' },
      { status: 500 }
    )
  }
}
