import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@ponto/shared'
import type { z } from 'zod'
import { CalendarClock, CircleAlert, Eye, EyeOff, FileText, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BrandMark } from '@/components/layout/BrandMark'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

type LoginForm = z.infer<typeof loginSchema>

const HIGHLIGHTS = [
  { icon: CalendarClock, text: 'Lançamento diário com cálculo automático de extras e faltas' },
  { icon: ShieldCheck, text: 'Banco de horas acumulado mês a mês' },
  { icon: FileText, text: 'Folha de ponto em PDF pronta para assinatura' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setError(null)
    try {
      const res = await authApi.login(data.email, data.password)
      login(res.data.user, res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 size-[28rem] rounded-full bg-orange-600/25 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10" />
          <div className="leading-tight">
            <p className="font-semibold text-sidebar-accent-foreground">Alexandre Motos</p>
            <p className="text-sm text-sidebar-muted">Betim · MG</p>
          </div>
        </div>

        <div className="relative mt-auto max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
              O ponto da oficina,
              <br />
              <span className="text-sidebar-primary">sem planilha.</span>
            </h2>
            <p className="text-[15px] leading-relaxed text-sidebar-muted">
              Registre entradas e saídas, acompanhe o banco de horas e gere a folha mensal de cada funcionário.
            </p>
          </div>
          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-sidebar-foreground">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 text-xs text-sidebar-muted/80">CNPJ 21.693.712/0001-03</p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[380px] animate-slide-in-up">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <BrandMark className="size-11" />
            <p className="text-sm font-medium text-muted-foreground">Alexandre Motos</p>
          </div>

          <div className="mb-7 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Entrar no Controle de Ponto</h1>
            <p className="text-sm text-muted-foreground">Use seu e-mail e senha para acessar o sistema.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@alexandremotos.com.br"
                className="h-10"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
            </FormField>

            <FormField label="Senha" htmlFor="password" error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-10 pr-10"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>

            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Problemas para acessar? Fale com o administrador do sistema.
          </p>
        </div>
      </main>
    </div>
  )
}
