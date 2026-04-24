import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import api from '../lib/api'
import useAuthStore from '../store/authStore'
import './Login.css'

const schema = z.object({
  email: z
    .string()
    .min(1, 'Veuillez saisir votre email.')
    .email('Format d\'email invalide.'),
  password: z.string().min(1, 'Veuillez saisir votre mot de passe.'),
  remember: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { setUser, setToken } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { remember: false },
  })

  useEffect(() => {
    const remembered = localStorage.getItem('nut.rememberEmail')
    if (remembered) {
      setValue('email', remembered)
      setValue('remember', true)
    }
  }, [setValue])

  const onSubmit = async (data: FormValues) => {
    setApiError(null)
    setIsLoading(true)

    try {
      const body = new URLSearchParams({
        username: data.email,
        password: data.password,
      })

      const loginRes = await api.post<{ access_token: string }>('/auth/login', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      const token = loginRes.data.access_token
      setToken(token)

      const meRes = await api.get('/auth/me')
      setUser(meRes.data)

      if (data.remember) {
        localStorage.setItem('nut.rememberEmail', data.email)
      } else {
        localStorage.removeItem('nut.rememberEmail')
      }

      navigate('/dashboard')
    } catch {
      setApiError('L\'email ou le mot de passe est incorrect. Vérifiez vos identifiants et réessayez.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Watermark */}
      <div className="bg-mark" aria-hidden="true">
        <svg viewBox="0 0 348 153.85" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#FFFFFF"
            d="M50.14,76.6c2.45,0,4.79,0.49,6.93,1.36L29.74,42.38c-4.98-6.49-14.17-7.81-20.79-3.12c-3.29,2.08-5.71,5.41-6.57,9.33c-0.27,1.35-0.35,2.74-0.25,4.11v83.31c0,8.16,6.62,14.78,14.78,14.78c8.16,0,14.78-6.62,14.78-14.78v-41.4C31.61,84.91,39.92,76.6,50.14,76.6 M97.43,140.5c0.51-1.5,0.8-3.11,0.8-4.78V50.95c0-8.17-6.62-14.78-14.78-14.78c-8.17,0-14.78,6.62-14.78,14.78v43.37c0,10.21-8.31,18.53-18.53,18.53c-1.88,0-3.7-0.29-5.41-0.81l25.69,33.44c5.1,6.64,14.63,7.89,21.27,2.79l0.55-0.43c2.2-1.69,3.8-3.88,4.78-6.28c0.07-0.16,0.12-0.32,0.19-0.48C97.28,140.89,97.36,140.7,97.43,140.5"
          />
        </svg>
      </div>

      <main className="login-shell" role="main">
        {/* Logo */}
        <div className="brand">
          <svg viewBox="0 3 100 148" xmlns="http://www.w3.org/2000/svg" aria-label="NUT">
            <path
              fill="#FFFFFF"
              d="M50.14,76.6c2.45,0,4.79,0.49,6.93,1.36L29.74,42.38c-4.98-6.49-14.17-7.81-20.79-3.12c-3.29,2.08-5.71,5.41-6.57,9.33c-0.27,1.35-0.35,2.74-0.25,4.11v83.31c0,8.16,6.62,14.78,14.78,14.78c8.16,0,14.78-6.62,14.78-14.78v-41.4C31.61,84.91,39.92,76.6,50.14,76.6 M97.43,140.5c0.51-1.5,0.8-3.11,0.8-4.78V50.95c0-8.17-6.62-14.78-14.78-14.78c-8.17,0-14.78,6.62-14.78,14.78v43.37c0,10.21-8.31,18.53-18.53,18.53c-1.88,0-3.7-0.29-5.41-0.81l25.69,33.44c5.1,6.64,14.63,7.89,21.27,2.79l0.55-0.43c2.2-1.69,3.8-3.88,4.78-6.28c0.07-0.16,0.12-0.32,0.19-0.48C97.28,140.89,97.36,140.7,97.43,140.5"
            />
          </svg>
        </div>

        <div className="card">
          <div className="card-head">
            <h1>Bon retour sur NUT</h1>
            <p>Connectez-vous pour accéder à votre plateforme de traçabilité.</p>
          </div>

          {/* Error alert */}
          {apiError && (
            <div className="alert" role="alert">
              <span className="alert-icon">
                <AlertCircle size={18} aria-hidden="true" />
              </span>
              <div className="alert-body">
                <strong>Impossible de se connecter.</strong><br />
                {apiError}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="on">
            {/* Email */}
            <div className={`field${errors.email ? ' has-error' : ''}`}>
              <label htmlFor="email">Email</label>
              <div className="input-wrap">
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  autoComplete="email"
                  placeholder="vous@entreprise.fr"
                  onChange={(e) => {
                    register('email').onChange(e)
                    if (apiError) setApiError(null)
                  }}
                />
              </div>
              {errors.email && (
                <div className="field-error">{errors.email.message}</div>
              )}
            </div>

            {/* Password */}
            <div className={`field${errors.password ? ' has-error' : ''}`}>
              <div className="field-helper-row">
                <label htmlFor="password" style={{ marginBottom: 0 }}>
                  Mot de passe
                </label>
                <a href="#">Mot de passe oublié ?</a>
              </div>
              <div className="input-wrap">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  onChange={(e) => {
                    register('password').onChange(e)
                    if (apiError) setApiError(null)
                  }}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <div className="field-error">{errors.password.message}</div>
              )}
            </div>

            {/* Remember me */}
            <div className="row">
              <label className="checkbox">
                <input
                  {...register('remember')}
                  type="checkbox"
                  id="remember"
                />
                <span>Se souvenir de moi</span>
              </label>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading && <Loader2 size={16} className="spin" />}
              <span>{isLoading ? 'Connexion…' : 'Se connecter'}</span>
            </button>
          </form>
        </div>

        <div className="footer-row">
          <span>© 2026 NUT</span>
          <div className="footer-links">
            <a href="#">Aide</a>
            <a href="#">Mentions légales</a>
            <a href="#">Confidentialité</a>
          </div>
        </div>
      </main>
    </div>
  )
}
