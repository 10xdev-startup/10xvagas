import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function GET(): Promise<Response> {
  const repositoryRoot = path.resolve(process.cwd(), '..')
  const csvPath = path.join(
    repositoryRoot,
    'engine/experiment/output/human-ranking.csv'
  )
  const csv = await readFile(csvPath, 'utf-8')

  return new Response(csv, {
    headers: {
      'Content-Disposition': 'attachment; filename="10xvagas-ranking-humano.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
    },
  })
}
