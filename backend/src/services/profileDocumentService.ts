import path from 'node:path'
import { supabase } from '@/database/supabase'
import { AppError } from '@/utils/AppError'

export const PROFILE_DOCUMENT_BUCKET = 'profile-documents'
export const PROFILE_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024

const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
}

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
}

function isDocx(buffer: Buffer): boolean {
  return buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && buffer[2] === 0x03
    && buffer[3] === 0x04
    && buffer.includes(Buffer.from('word/document.xml', 'utf8'))
}

function isUtf8Text(buffer: Buffer): boolean {
  try {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return !value.includes('\0') && value.trim().length > 0
  } catch {
    return false
  }
}

export function validateProfileDocument(file: Express.Multer.File): { extension: string; originalName: string } {
  const extension = MIME_TO_EXTENSION[file.mimetype]
  if (!extension) {
    throw new AppError(415, 'Envie um arquivo PDF, DOCX ou TXT', 'UNSUPPORTED_DOCUMENT_TYPE')
  }
  if (file.size <= 0 || file.size > PROFILE_DOCUMENT_MAX_BYTES) {
    throw new AppError(413, 'O curriculo deve ter no maximo 8 MB', 'DOCUMENT_TOO_LARGE')
  }

  const signatureIsValid = extension === '.pdf'
    ? isPdf(file.buffer)
    : extension === '.docx'
      ? isDocx(file.buffer)
      : isUtf8Text(file.buffer)
  if (!signatureIsValid) {
    throw new AppError(422, 'O conteudo do arquivo nao corresponde ao formato informado', 'INVALID_DOCUMENT_CONTENT')
  }

  const rawName = [...path.basename(file.originalname)]
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join('')
    .trim()
  const originalName = (rawName || `curriculo${extension}`).slice(0, 180)
  return { extension, originalName }
}

export const ProfileDocumentService = {
  async upload(params: { file: Express.Multer.File; jobId: string; userId: string }): Promise<{
    documentName: string
    documentPath: string
  }> {
    const { extension, originalName } = validateProfileDocument(params.file)
    const documentPath = `${params.userId}/${params.jobId}/document${extension}`
    const { error } = await supabase.storage.from(PROFILE_DOCUMENT_BUCKET).upload(
      documentPath,
      params.file.buffer,
      { contentType: params.file.mimetype, upsert: false },
    )
    if (error) throw new Error(`Falha ao armazenar curriculo: ${error.message}`)
    return { documentName: originalName, documentPath }
  },

  async remove(documentPath: string): Promise<void> {
    const { error } = await supabase.storage.from(PROFILE_DOCUMENT_BUCKET).remove([documentPath])
    if (error) console.warn('[ProfileDocumentService] falha ao remover upload orfao', { message: error.message })
  },
}
