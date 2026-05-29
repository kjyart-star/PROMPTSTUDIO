declare module 'node-id3' {
  export interface Tags {
    title?: string
    artist?: string
    album?: string
    image?: {
      mime: string
      type: {
        id: number
        name?: string
      }
      description?: string
      imageBuffer: Buffer
    }
  }

  export function write(tags: Tags, filebuffer: Buffer): Buffer
  export function create(tags: Tags): Buffer
}
