import { useAuth, useSignIn, useSignUp } from '@clerk/react';
import { ArrowRight, Home, KeyRound, Mail, ShieldCheck, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMyProfileQueryKey, updateMyProfile } from '@workspace/api-client-react';

type Mode = 'login' | 'register' | 'verify';
type Role = 'customer' | 'contractor';
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Spróbuj ponownie.';
  const candidate = error as {
    message?: string;
    longMessage?: string;
    errors?: Array<{ longMessage?: string; message?: string }>;
  };
  return candidate.errors?.[0]?.longMessage
    ?? candidate.errors?.[0]?.message
    ?? candidate.longMessage
    ?? candidate.message
    ?? 'Spróbuj ponownie.';
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${light ? 'text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--foreground))]'}`}>
      <img src={`${basePath}/logo-horizontal.png`} alt="Zleć Majstra" className={`h-10 w-auto max-w-[210px] object-contain object-left ${light ? 'rounded-md bg-white/95 p-1.5' : ''}`} />
    </Link>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">{label}</span>
      <input
        {...props}
        className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3.5 text-sm text-[hsl(var(--foreground))] outline-none transition focus:border-[hsl(var(--primary))]"
      />
    </label>
  );
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<Role>('customer');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const isPending = signUpStatus === 'fetching' || signInStatus === 'fetching';
  const requestedRedirect = new URLSearchParams(window.location.search).get('redirect');
  const destination =
    requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/dashboard';

  useEffect(() => {
    if (isLoaded && isSignedIn && mode !== 'verify') {
      setLocation(destination);
    }
  }, [destination, isLoaded, isSignedIn, mode, setLocation]);

  const changeMode = (nextMode: Exclude<Mode, 'verify'>) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    if (nextMode === 'login') setAcceptedTerms(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    try {
      if (mode === 'login') {
        const result = await signIn.password({
          identifier: email.trim(),
          password,
        });
        if (result.error) {
          setError(errorMessage(result.error));
          return;
        }
        const finalized = await signIn.finalize();
        if (finalized.error) {
          setError(errorMessage(finalized.error));
          return;
        }
        setLocation(destination);
        return;
      }

      if (password.length < 8) {
        setError('Hasło musi mieć minimum 8 znaków.');
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError('Hasło musi zawierać co najmniej jedną wielką literę.');
        return;
      }
      if (!acceptedTerms) {
        setError('Zaakceptuj Regulamin aplikacji, aby założyć konto.');
        return;
      }
      if (
        role === 'contractor' &&
        (!companyName.trim() ||
          !companyAddress.trim() ||
          !serviceLocation.trim() ||
          !/^\d{10}$/.test(nip))
      ) {
        setError('Podaj nazwę firmy, adres firmy, miejscowość obsługi i poprawny 10-cyfrowy NIP.');
        return;
      }

      const result = await signUp.password({
        emailAddress: email.trim(),
        password,
      });
      if (result.error) {
        setError(errorMessage(result.error));
        return;
      }

      const verification = await signUp.verifications.sendEmailCode();
      if (verification.error) {
        setError(errorMessage(verification.error));
        return;
      }
      setMode('verify');
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    try {
      const result = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (result.error) {
        setError(errorMessage(result.error));
        return;
      }
      if (signUp.status !== 'complete') {
        setError('Kod jest poprawny, ale rejestracja nie została jeszcze ukończona.');
        return;
      }
      const finalized = await signUp.finalize();
      if (finalized.error) {
        setError(errorMessage(finalized.error));
        return;
      }

      const createdProfile = await updateMyProfile({
        role,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        companyName: role === 'contractor' ? companyName.trim() : null,
        companyAddress: role === 'contractor' ? companyAddress.trim() : null,
        serviceLocation: role === 'contractor' ? serviceLocation.trim() : null,
        nip: role === 'contractor' ? nip : null,
      });
      if (userId) {
        queryClient.setQueryData(
          [...getGetMyProfileQueryKey(), userId],
          createdProfile,
        );
      }
      void queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      localStorage.setItem('zr-role', role);
      setLocation(destination);
    } catch (verificationError) {
      setError(errorMessage(verificationError));
    }
  };

  const resend = async () => {
    setError('');
    const result = await signUp.verifications.sendEmailCode();
    if (result.error) setError(errorMessage(result.error));
    else setNotice('Wysłaliśmy nowy kod weryfikacyjny.');
  };

  const roleOptions: Array<{ value: Role; label: string; Icon: typeof Home }> = [
    { value: 'customer', label: 'Zleceniodawca', Icon: Home },
    { value: 'contractor', label: 'Fachowiec', Icon: Wrench },
  ];

  if (isLoaded && isSignedIn) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))] px-5 text-center">
        <div>
          <p className="font-[var(--app-font-serif)] text-2xl font-bold">Jesteś już zalogowany.</p>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Przenosimy Cię do Twojej przestrzeni.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[100dvh] bg-[hsl(var(--background))] md:grid-cols-[.85fr_1.15fr]">
      <div className="hidden bg-[hsl(var(--sidebar))] p-12 text-[hsl(var(--sidebar-foreground))] md:flex md:flex-col">
        <Logo light />
        <div className="mt-auto max-w-[430px]">
          <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
            <KeyRound size={22} />
          </div>
          <h1 className="font-[var(--app-font-serif)] text-5xl font-bold leading-[.98] tracking-tight">
            Dobre decyzje<br />zaczynają się<br />
            <span className="text-[hsl(var(--primary))]">od konkretów.</span>
          </h1>
          <p className="mt-6 max-w-[330px] text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.65)]">
            Twoje zlecenia, kontakty i prace w jednym spokojnym miejscu.
          </p>
        </div>
        <div className="mt-auto flex gap-3 pt-16 text-xs text-[hsl(var(--sidebar-foreground)/.48)]">
          <ShieldCheck size={15} /> Dane chronione i traktowane poważnie
        </div>
      </div>

      <div className="flex flex-col px-5 py-8 sm:px-12 md:justify-center md:px-[clamp(2rem,8vw,9rem)]">
        <div className="mb-16 md:hidden"><Logo /></div>
        <div className="mx-auto w-full max-w-[440px]">
          {mode === 'verify' ? (
            <form onSubmit={verify} className="rise-in">
              <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]">
                <Mail size={24} />
              </div>
              <h2 className="font-[var(--app-font-serif)] text-4xl font-bold tracking-tight">Sprawdź swoją skrzynkę.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                Wysłaliśmy 6-cyfrowy kod na <strong>{email.trim()}</strong>.
              </p>
              <div className="mt-8">
                <Field
                  required
                  autoFocus
                  label="Kod weryfikacyjny"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  data-testid="input-verification-code"
                />
              </div>
              {error && <p className="mt-3 text-sm font-semibold text-[hsl(var(--destructive))]" role="alert">{error}</p>}
              {notice && <p className="mt-3 text-sm font-semibold text-[hsl(var(--secondary-foreground))]" role="status">{notice}</p>}
              <button
                type="submit"
                disabled={code.length < 6 || isPending}
                className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50"
                data-testid="button-verify-email"
              >
                {isPending ? 'Weryfikuję…' : 'Potwierdź email'}
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={isPending}
                className="mt-4 w-full text-center text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:underline disabled:opacity-50"
                data-testid="button-resend-code"
              >
                Wyślij kod ponownie
              </button>
            </form>
          ) : (
            <>
              <Link href="/" className="mb-10 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                ← Wróć na stronę główną
              </Link>
              <div className="mb-8 flex rounded-xl bg-[hsl(var(--muted))] p-1">
                <button type="button" onClick={() => changeMode('login')} className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${mode === 'login' ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>Logowanie</button>
                <button type="button" onClick={() => changeMode('register')} className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${mode === 'register' ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>Rejestracja</button>
              </div>
              <h2 className="font-[var(--app-font-serif)] text-4xl font-bold tracking-tight">{mode === 'login' ? 'Dobrze Cię widzieć.' : 'Zacznijmy od planu.'}</h2>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{mode === 'login' ? 'Zaloguj się do swojej przestrzeni.' : 'Załóż konto i potwierdź adres email.'}</p>

              <form onSubmit={submit} className="mt-8 space-y-5">
                {mode === 'register' && (
                  <>
                    <div>
                      <span className="mb-2 block text-[12px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">Jestem tutaj jako</span>
                      <div className="grid grid-cols-2 gap-2">
                        {roleOptions.map(({ value, label, Icon }) => (
                          <button
                            type="button"
                            key={value}
                            onClick={() => setRole(value)}
                            className={`focus-ring flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${role === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}
                          >
                            <Icon size={15} /> {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field required label="Imię" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="np. Anna" />
                      <Field required label="Nazwisko" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="np. Nowak" />
                    </div>
                    <Field required label="Telefon" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+48 500 000 000" />
                    {role === 'contractor' && (
                      <div className="space-y-4 rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.06)] p-4">
                        <Field required label="Nazwa firmy" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="np. Solidny Fach Sp. z o.o." />
                        <Field required label="Adres firmy" value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} placeholder="ul. Rzemieślnicza 12, Warszawa" />
                        <Field required label="Miejscowość obsługi" value={serviceLocation} onChange={(event) => setServiceLocation(event.target.value)} placeholder="np. Warszawa" />
                        <Field required label="NIP" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} value={nip} onChange={(event) => setNip(event.target.value.replace(/\D/g, ''))} placeholder="1234567890" />
                      </div>
                    )}
                  </>
                )}
                <Field required type="email" label="Adres e-mail" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ty@przyklad.pl" />
                <Field required type="password" label="Hasło" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'login' ? 'Minimum 8 znaków' : 'Min. 8 znaków, w tym 1 wielka litera'} />
                {mode === 'register' && <p className="-mt-3 text-xs text-[hsl(var(--muted-foreground))]">Minimum 8 znaków, w tym co najmniej 1 wielka litera.</p>}
                {mode === 'register' && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-xs leading-relaxed">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) => setAcceptedTerms(event.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
                      data-testid="checkbox-registration-terms"
                    />
                    <span>
                      Akceptuję <Link href="/regulamin" target="_blank" className="font-bold text-[hsl(var(--primary))] underline underline-offset-2" data-testid="link-registration-terms">Regulamin aplikacji</Link> i zobowiązuję się go przestrzegać.
                    </span>
                  </label>
                )}
                {error && <p className="text-sm font-semibold text-[hsl(var(--destructive))]" role="alert">{error}</p>}
                {mode === 'register' && <div id="clerk-captcha" />}
                <button
                  type="submit"
                  disabled={isPending || (mode === 'register' && !acceptedTerms)}
                  className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(var(--foreground)/.14)] disabled:opacity-50"
                  data-testid="button-submit-auth"
                >
                  {isPending ? 'Proszę czekać…' : mode === 'login' ? 'Zaloguj się' : <>Utwórz konto <ArrowRight size={16} /></>}
                </button>
                <p className="text-center text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                  Kontynuując, akceptujesz regulamin i politykę prywatności.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
