import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import ffmpegPath from 'ffmpeg-static'

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

    let ffmpegExecutable = 'ffmpeg'
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      ffmpegExecutable = ffmpegPath
    }

    // Run ffmpeg to transcode WAV -> 320kbps MP3
    await new Promise<void>((resolve, reject) => {
      const ffmpegProcess = spawn(ffmpegExecutable, [
        '-y',
        '-i', inputTmpPath,
        '-codec:a', 'libmp3lame',
        '-b:a', '320k',
        outputTmpPath
      ])

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
