import { describe, expect, it } from '@jest/globals'
import { validateProfileDocument } from '@/services/profileDocumentService'

function file(buffer: Buffer, mimetype: string, originalname = 'curriculo'): Express.Multer.File {
  return {
    buffer,
    destination: '',
    encoding: '7bit',
    fieldname: 'document',
    filename: '',
    mimetype,
    originalname,
    path: '',
    size: buffer.length,
    stream: null as never,
  }
}

describe('validateProfileDocument', () => {
  it('aceita PDF pela assinatura e remove caracteres de controle do nome', () => {
    const result = validateProfileDocument(file(Buffer.from('%PDF-1.7\nconteudo'), 'application/pdf', 'cv\u0000 agosto.pdf'))

    expect(result).toEqual({ extension: '.pdf', originalName: 'cv agosto.pdf' })
  })

  it('rejeita um ZIP comum disfarçado de DOCX', () => {
    expect(() => validateProfileDocument(file(
      Buffer.from('PK\u0003\u0004arquivo.txt'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ))).toThrow('conteudo do arquivo nao corresponde')
  })

  it('aceita DOCX somente quando o pacote contem word/document.xml', () => {
    const buffer = Buffer.from('PK\u0003\u0004word/document.xml')

    expect(validateProfileDocument(file(
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'perfil.docx',
    ))).toEqual({ extension: '.docx', originalName: 'perfil.docx' })
  })

  it('rejeita texto vazio e MIME fora da allowlist', () => {
    expect(() => validateProfileDocument(file(Buffer.from('   '), 'text/plain'))).toThrow('conteudo do arquivo nao corresponde')
    expect(() => validateProfileDocument(file(Buffer.from('gif'), 'image/gif'))).toThrow('PDF, DOCX ou TXT')
  })
})
