import { FileUp, Sparkles, Target } from 'lucide-react'

const STEPS = [
  { icon: FileUp, title: 'Importe seu currículo', detail: 'PDF ou DOCX viram o Perfil Canônico, com experiências e stack estruturadas.' },
  { icon: Target, title: 'Separe o que você quer usar', detail: 'A stack que você domina e a que você quer trabalhar são listas diferentes — é isso que evita vaga fora do alvo.' },
  { icon: Sparkles, title: 'O radar passa a ranquear por você', detail: 'Cada vaga ganha score, motivos e o que falta, comparados com o seu perfil.' },
]

export function ProfileOnboarding(): React.JSX.Element {
  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Perfil Canônico</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Seu perfil ainda não existe.</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        O radar ranqueia vagas comparando cada descrição com o seu perfil. Sem ele, dá para
        navegar as vagas, mas não há match calculado.
      </p>

      <ol className="mt-10 space-y-6 border-t border-border/70 pt-8">
        {STEPS.map(({ icon: Icon, title, detail }, index) => (
          <li className="flex gap-4" key={title}>
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-border bg-card text-brand">
              <Icon className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">
                <span className="mr-2 font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                {title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-10 border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        A importação por conta ainda está em construção. Hoje o Perfil Canônico é gerado
        localmente pelo engine e persistido no Supabase.
      </p>
    </section>
  )
}
