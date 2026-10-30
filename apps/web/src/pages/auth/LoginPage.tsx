import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@ponto/shared'
import type { z } from 'zod'
import { CircleAlert, Eye, EyeOff } from 'lucide-react'
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
  'Lançamento diário com cálculo de extras e faltas',
  'Banco de horas acumulado mês a mês',
  'Folha de ponto em PDF para assinatura',
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
    <div className="grid min-h-full lg:grid-cols-[minmax(0,26rem)_1fr]">
      {/* Brand panel */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-accent-foreground">Alexandre Motos</p>
            <p className="text-xs text-sidebar-muted">Controle de ponto</p>
          </div>
        </div>

        <div className="mt-auto max-w-sm space-y-5">
          <h2 className="text-2xl font-semibold leading-snug tracking-tight text-sidebar-accent-foreground">
            Ponto, banco de horas e folha mensal da oficina em um só lugar.
          </h2>
          <ul className="space-y-2 text-sm text-sidebar-muted">
            {HIGHLIGHTS.map((text) => (
              <li key={text} className="flex gap-2.5">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-sidebar-muted" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-12 text-xs leading-relaxed text-sidebar-muted">
          CNPJ 21.693.712/0001-03
          <br />
          Av. Colet. Artur Trindade, 1488 · Jd. Alterosa · Betim, MG
        </p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[360px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">Alexandre Motos</p>
              <p className="text-xs text-muted-foreground">Controle de ponto</p>
            </div>
          </div>

          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Entrar</h1>
            <p className="text-sm text-muted-foreground">Use seu e-mail e senha de acesso.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

            <Button type="submit" size="lg" className="mt-2 w-full" loading={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            Problemas para acessar? Fale com o administrador do sistema.
          </p>
        </div>
      </main>
    </div>
  )
}
