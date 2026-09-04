import { useEffect, useMemo, useRef, useState } from 'react';
import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, BadgeCheck, Bell, BriefcaseBusiness, Building2, Check, ChevronRight,
  CircleAlert, CircleHelp, Clock3, Compass, CreditCard, Hammer, Home as HomeIcon,
  History, KeyRound, LayoutDashboard, ListFilter, LockKeyhole, LogIn, LogOut, Mail, MapPin, Menu,
   Camera, MessageCircle, Pencil, Phone, Plus, Search, Settings, ShieldCheck,
  Sparkles, Star, Tag, UserRound, Wrench, Zap, X, Sliders
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey, getGetMyProfileQueryKey, getGetRequestQueryKey,
  getGetNotificationsQueryKey, getGetPaymentStatusQueryKey, getGetSubscriptionQueryKey, getListRequestsQueryKey, getListRequestConversationsQueryKey, getHealthCheckQueryKey,
  type JobRequest, type JobRequestInput, type Profile, type DashboardSummary, type Subscription, type SubscriptionRenewalReminder, type ContactAccess, type ConversationNotification,
  requestCategories, requestCategoryLabels, setAuthTokenGetter,
  useCreateRequest, useGetDashboardSummary, useGetMyProfile, useGetNotifications, useGetPaymentStatus, useGetRequest,
  useGetSubscription, useListRequests, useListRequestConversations, useRequestUploadUrl, useStartSubscription, useHealthCheck, useUpdateMyProfile, useUpdateRequest,
  useUnlockRequestContact, useListAdminSubscriptions, getListAdminSubscriptionsQueryKey,
  useListAdminSubscriptionHistory, getListAdminSubscriptionHistoryQueryKey, useUpdateAdminSubscription,
  useListAdminUsers, getListAdminUsersQueryKey, useUpdateAdminUser, useDeleteAdminUser,
  useGetAdminOverview, getGetAdminOverviewQueryKey,
  useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings,
  useUpdateAdminRequest, useGetSiteSettings, getGetSiteSettingsQueryKey, useSendChatbotMessage,
  useListAdminRequests, getListAdminRequestsQueryKey, useDeleteAdminRequest,
  type AdminSubscriptionStatusHistory
} from '@workspace/api-client-react';
import {
  Link, Route, Router as WouterRouter, Switch, useLocation, useParams
} from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequestReviews } from '@/components/request-reviews';
import { RequestConversation } from '@/components/request-conversation';
import NotFound from '@/pages/not-found';
import RealAuthPage from '@/pages/auth-page';
import { trackEvent } from '@/lib/analytics';
const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.PROD
  ? import.meta.env.VITE_CLERK_PROXY_URL
  : undefined;

function ApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;

    const currentUserId = isSignedIn ? userId ?? null : null;
    if (
      previousUserId.current !== undefined &&
      previousUserId.current !== currentUserId
    ) {
      queryClient.clear();
    }
    previousUserId.current = currentUserId;
  }, [isLoaded, isSignedIn, userId]);

  return children;
}

function getSessionProfileQueryKey(userId: string | null | undefined) {
  return [...getGetMyProfileQueryKey(), userId ?? 'signed-out'] as const;
}

const demoRequests: JobRequest[] = [
  { id: 101, customerName: 'Karolina W.', title: 'Remont łazienki w mieszkaniu', description: 'Szukam ekipy do kompleksowego remontu łazienki w kamienicy. Zakres obejmuje płytki, biały montaż i oświetlenie.', category: 'remont', location: 'Gdańsk, Wrzeszcz', address: null, budget: '18 000–24 000 zł', status: 'open', createdAt: '2024-06-18T10:00:00Z', photos: [], contactAvailable: false },
  { id: 102, customerName: 'Tomasz K.', title: 'Instalacja elektryczna w domu', description: 'Nowy dom w stanie surowym. Potrzebuję wykonania instalacji elektrycznej oraz przygotowania pod smart home.', category: 'elektryka', location: 'Poznań, Jeżyce', address: null, budget: '32 000 zł', status: 'open', createdAt: '2024-06-17T15:30:00Z', photos: [], contactAvailable: false },
  { id: 103, customerName: 'Aneta i Piotr', title: 'Przeciek przy odpływie tarasowym', description: 'Po większym deszczu pojawia się wilgoć przy drzwiach tarasowych. Potrzebna szybka diagnoza i naprawa.', category: 'hydraulika', location: 'Wrocław, Krzyki', address: 'ul. Przykładowa 12, Wrocław', budget: '2 000–4 000 zł', status: 'in_progress', createdAt: '2024-06-16T08:20:00Z', photos: [], contactAvailable: true, customerEmail: 'aneta.piotr@example.com', customerPhone: '+48 602 113 884' }
];
const demoSummary: DashboardSummary = { openRequests: 42, myRequests: 7, newThisWeek: 12, unlockedContacts: 4, topCategories: [{ category: 'remont', count: 18 }, { category: 'hydraulika', count: 11 }, { category: 'elektryka', count: 8 }] };
const demoSubscription: Subscription = { status: 'inactive', planName: 'Profesjonalista', monthlyPrice: '99 zł / mies.', canUnlockContacts: false, activationRequested: false, paymentInstructions: 'Płatność online przez PayU.', paymentProvider: null, paymentStatus: null, accessExpiresAt: null, renewalReminder: null };

const categoryLabels: Record<string, string> = requestCategoryLabels;
const legacyCategoryLabels: Record<string, string> = { remont: 'Remont', budowa: 'Budowa', hydraulika: 'Hydraulika', elektryka: 'Elektryka' };
const statusLabels: Record<string, string> = { open: 'Otwarte', in_progress: 'W realizacji', completed: 'Zakończone' };
const categoryIcons: Record<string, typeof Hammer> = { remont: Hammer, budowa: Building2, hydraulika: Wrench, elektryka: Zap };

function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`focus-ring flex items-center gap-2.5 ${light ? 'text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--foreground))]'}`} data-testid="link-logo">
    <img src={`${basePath}/logo-horizontal.png`} alt="Zleć Majstra" className={`h-10 w-auto max-w-[185px] object-contain object-left ${light ? 'rounded-md bg-white/95 p-1.5' : ''}`} />
  </Link>;
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'dark' }) {
  const variants = {
    primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(var(--foreground)/.14)] hover:-translate-y-0.5 hover:shadow-[0_5px_0_hsl(var(--foreground)/.14)]',
    outline: 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)]',
    ghost: 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
    dark: 'bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] shadow-[0_3px_0_hsl(var(--foreground)/.14)] hover:-translate-y-0.5'
  };
  return <button {...props} className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}>{children}</button>;
}

function Field({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <label className="block space-y-1.5"><span className="text-[12px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">{label}</span><input {...props} className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3.5 text-sm text-[hsl(var(--foreground))] outline-none transition focus:border-[hsl(var(--primary))]" />{error && <span className="text-xs text-[hsl(var(--destructive))]">{error}</span>}</label>;
}


function SiteAnnouncement() {
  const { data: settings } = useGetSiteSettings({ query: { queryKey: getGetSiteSettingsQueryKey() }});
  if (!settings?.announcement) return null;
  return (
    <div className="w-full bg-[hsl(var(--primary))] px-4 py-2.5 text-center text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="site-announcement">
      {settings.announcement}
    </div>
  );
}

function ChatbotWidget() {
  const { data: settings } = useGetSiteSettings({ query: { queryKey: getGetSiteSettingsQueryKey() }});
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'bot', text: string}[]>([]);
  const [input, setInput] = useState('');
  const sendMessage = useSendChatbotMessage();

  if (!settings?.chatbotEnabled) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    sendMessage.mutate({ data: { message: userMsg } }, {
      onSuccess: (res) => {
        setMessages(prev => [...prev, { role: 'bot', text: res.reply }]);
      },
      onError: () => {
        setMessages(prev => [...prev, { role: 'bot', text: "Przepraszamy, wystąpił błąd komunikacji." }]);
      }
    });
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-3" data-testid="chatbot-widget">
      {isOpen && (
        <div className="w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl flex flex-col overflow-hidden rise-in">
          <div className="bg-[hsl(var(--primary))] p-4 text-[hsl(var(--primary-foreground))] flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">{settings.chatbotName || 'Wirtualny asystent'}</p>
              <p className="text-[10px] opacity-80">Odpowiada na częste pytania</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-black/10 p-1.5 rounded-lg transition"><X size={16} /></button>
          </div>
          <div className="h-[320px] overflow-y-auto p-4 space-y-4 bg-[hsl(var(--muted)/.3)]">
            <div className="flex gap-2">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-bold"><MessageCircle size={14} /></div>
              <div className="rounded-2xl rounded-tl-none bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-3 text-sm shadow-sm">
                {settings.chatbotWelcomeMessage || 'W czym mogę pomóc?'}
              </div>
            </div>
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'bot' && <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-bold"><MessageCircle size={14} /></div>}
                <div className={`rounded-2xl p-3 text-sm shadow-sm ${m.role === 'user' ? 'rounded-tr-none bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]' : 'rounded-tl-none bg-[hsl(var(--card))] border border-[hsl(var(--border))]'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {sendMessage.isPending && (
              <div className="flex gap-2">
                <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-bold"><MessageCircle size={14} /></div>
                <div className="rounded-2xl rounded-tl-none bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-3 text-sm shadow-sm flex gap-1 items-center">
                  <span className="size-1.5 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce" />
                  <span className="size-1.5 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce delay-100" />
                  <span className="size-1.5 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce delay-200" />
                </div>
              </div>
            )}
          </div>
          <form onSubmit={handleSend} className="p-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div className="relative">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Napisz wiadomość..." className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-2.5 pr-10 text-sm outline-none focus:border-[hsl(var(--primary))] disabled:opacity-50" disabled={sendMessage.isPending} />
              <button type="submit" disabled={!input.trim() || sendMessage.isPending} className="absolute right-1.5 top-1.5 p-1.5 text-[hsl(var(--primary))] disabled:opacity-50 hover:bg-[hsl(var(--primary)/.1)] rounded-lg transition" data-testid="button-chatbot-send"><ArrowRight size={16} /></button>
            </div>
          </form>
        </div>
      )}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="grid size-14 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-xl hover:-translate-y-1 transition-all" aria-label="Otwórz czat" data-testid="chatbot-toggle">
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}

function AppShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const [location, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { isSignedIn } = useAuth();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  );
  const notifications = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      enabled: isSignedIn,
      retry: false,
      refetchInterval: 10_000,
    },
  });
  const unreadCount = notifications.data?.unreadConversations ?? 0;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const previousUnread = useRef<number | null>(null);
  const { signOut } = useClerk();
  useEffect(() => {
    if (
      previousUnread.current !== null &&
      unreadCount > previousUnread.current &&
      document.hidden &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      new Notification('Nowa wiadomość w rozmowie', {
        body: 'Masz nową wiadomość. Otwórz aplikację, aby ją przeczytać.',
      });
    }
    previousUnread.current = unreadCount;
  }, [unreadCount]);
  const enableSystemNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    setNotificationPermission(await Notification.requestPermission());
  };
  const handleSignOut = async () => {
    queryClient.clear();
    await signOut();
    setLocation('/auth');
  };
  const nav = [
    { href: '/dashboard', label: 'Pulpit', icon: LayoutDashboard },
    { href: '/messages', label: 'Wiadomości', icon: MessageCircle },
    { href: '/requests', label: profile.role === 'contractor' ? 'Zlecenia' : 'Moje zlecenia', icon: BriefcaseBusiness },
    ...(profile.role === 'contractor' ? [{ href: '/billing', label: 'Abonament', icon: CreditCard }] : []),
    ...(profile.role === 'admin' ? [{ href: '/admin/overview', label: 'Statystyki', icon: LayoutDashboard }] : []),
    ...(profile.role === 'admin' ? [{ href: '/admin/subscriptions', label: 'Abonamenty', icon: ShieldCheck }] : []),
    ...(profile.role === 'admin' ? [{ href: '/admin/moderation', label: 'Moderacja', icon: UserRound }] : []),
    ...(profile.role === 'admin' ? [{ href: '/admin/settings', label: 'Ustawienia', icon: Sliders }] : []),
    { href: '/profile', label: 'Profil i ustawienia', icon: Settings }
  ];
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-[hsl(var(--sidebar))] px-4 py-6 text-[hsl(var(--sidebar-foreground))] md:flex">
      <div className="px-2"><Logo light /></div>
      <div className="mt-12 px-2 text-[10px] font-bold uppercase tracking-[.17em] text-[hsl(var(--sidebar-foreground)/.5)]">Twoja przestrzeń</div>
      <nav className="mt-3 space-y-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${location === href ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-[inset_3px_0_hsl(var(--primary))]' : 'text-[hsl(var(--sidebar-foreground)/.67)] hover:bg-[hsl(var(--sidebar-accent)/.7)] hover:text-[hsl(var(--sidebar-foreground))]'}`} data-testid={`link-nav-${label}`}><Icon size={18} /><span>{label}</span>{href === '/messages' && unreadCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-[hsl(var(--primary))] px-1.5 py-0.5 text-center text-[10px] font-bold text-[hsl(var(--primary-foreground))]" data-testid="nav-unread-count">{unreadLabel}</span>}{location === href && !(href === '/messages' && unreadCount > 0) && <ChevronRight size={15} className="ml-auto text-[hsl(var(--primary))]" />}</Link>)}</nav>
      <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.5)] p-4 blueprint-grid">
        <div className="mb-3 grid size-8 place-items-center rounded-lg bg-[hsl(var(--primary)/.16)] text-[hsl(var(--primary))]"><CircleHelp size={17} /></div>
        <p className="text-sm font-bold">Potrzebujesz pomocy?</p><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--sidebar-foreground)/.6)]">Zajrzyj do centrum wsparcia dla swojej roli.</p>
        <button className="mt-3 text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid="button-support">Centrum wsparcia <ArrowRight size={12} className="ml-1 inline" /></button>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] px-2 pt-5">
        <span className="grid size-9 place-items-center rounded-full bg-[hsl(var(--accent))] text-xs font-bold text-[hsl(var(--accent-foreground))]">{profile.firstName[0]}{profile.lastName[0]}</span>
        <div className="min-w-0"><p className="truncate text-sm font-bold">{profile.firstName} {profile.lastName}</p><p className="truncate text-xs text-[hsl(var(--sidebar-foreground)/.55)]">{profile.role === 'contractor' ? 'Fachowiec' : 'Zleceniodawca'}</p></div>
      </div>
      <button onClick={() => void handleSignOut()} className="focus-ring mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[hsl(var(--sidebar-foreground)/.67)] transition hover:bg-[hsl(var(--sidebar-accent)/.7)] hover:text-[hsl(var(--sidebar-foreground))]" data-testid="button-sign-out">
        <LogOut size={18} /><span>Wyloguj się</span>
      </button>
    </aside>
    <div className="md:pl-[248px] flex flex-col min-h-[100dvh]">
      <SiteAnnouncement />
      <header className="sticky top-0 z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.9)] px-5 backdrop-blur-md md:px-10">
        <div className="md:hidden"><Logo /></div><div className="hidden text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] md:block">Dzień dobry, {profile.firstName}</div>
        <div className="relative flex items-center gap-2"><button className="focus-ring relative grid size-10 place-items-center rounded-xl text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" onClick={() => setNotificationsOpen((open) => !open)} aria-label={unreadCount > 0 ? `Powiadomienia: ${unreadCount} nieprzeczytanych rozmów` : 'Powiadomienia'} data-testid="button-notifications"><Bell size={18} />{unreadCount > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-[hsl(var(--primary))] px-1 text-[9px] font-bold leading-4 text-[hsl(var(--primary-foreground))]" data-testid="notification-unread-count">{unreadLabel}</span>}</button><button className="focus-ring grid size-10 place-items-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] md:hidden" onClick={() => setMobileNav(!mobileNav)} data-testid="button-mobile-menu"><Menu size={18} /></button>
          {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl" data-testid="notifications-panel"><div className="border-b border-[hsl(var(--border))] p-4"><p className="font-bold">Powiadomienia</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'nieprzeczytana rozmowa' : 'nieprzeczytane rozmowy'}` : 'Wszystkie rozmowy są przeczytane'}</p></div>{notifications.data?.notifications.length ? <div className="max-h-80 overflow-y-auto p-2">{notifications.data.notifications.map((notification) => <Link key={notification.conversationId} href={`/requests/${notification.requestId}?conversationId=${notification.conversationId}`} onClick={() => setNotificationsOpen(false)} className="block rounded-xl p-3 hover:bg-[hsl(var(--muted))]" data-testid={`notification-conversation-${notification.conversationId}`}><p className="text-sm font-bold">{notification.title}</p><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{notification.body}</p><time className="mt-2 block text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{new Date(notification.createdAt).toLocaleString('pl-PL')}</time></Link>)}</div> : <p className="p-5 text-sm text-[hsl(var(--muted-foreground))]">Nie masz nowych wiadomości.</p>}{notificationPermission === 'default' && <button onClick={() => void enableSystemNotifications()} className="w-full border-t border-[hsl(var(--border))] px-4 py-3 text-left text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-enable-system-notifications">Włącz powiadomienia systemowe</button>}</div>}
        </div>
      </header>
       {mobileNav && <div className="fixed inset-x-3 top-[75px] z-40 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-xl md:hidden">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold hover:bg-[hsl(var(--muted))]" data-testid={`mobile-nav-${label}`}><Icon size={17} />{label}{href === '/messages' && unreadCount > 0 && <span className="ml-auto min-w-5 rounded-full bg-[hsl(var(--primary))] px-1.5 py-0.5 text-center text-[10px] font-bold text-[hsl(var(--primary-foreground))]">{unreadLabel}</span>}</Link>)}<button onClick={() => { setMobileNav(false); void handleSignOut(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]" data-testid="mobile-button-sign-out"><LogOut size={17} />Wyloguj się</button></div>}
      <main className="mx-auto max-w-[1260px] px-5 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  </div>;
}

function PublicHeader({ style }: { style?: React.CSSProperties }) {
  return <header style={style} className="absolute inset-x-0 top-0 z-10 flex h-[76px] items-center justify-between px-5 md:px-12"><Logo /><div className="flex items-center gap-3"><Link href="/auth" className="focus-ring hidden px-3 py-2 text-sm font-bold text-[hsl(var(--foreground))] sm:block" data-testid="link-sign-in">Zaloguj się</Link><Link href="/auth" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--sidebar))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--sidebar-foreground))] shadow-[0_3px_0_hsl(var(--foreground)/.14)] transition hover:-translate-y-0.5" data-testid="link-header-cta">Zacznij teraz <ArrowRight size={15} /></Link></div></header>;
}

function Landing() {
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  const healthStatus = health?.status ?? 'online';
  const { data: settings } = useGetSiteSettings({ query: { queryKey: getGetSiteSettingsQueryKey() }});
  const hasAnnouncement = !!settings?.announcement;

  const examples = [
    { icon: Hammer, title: 'Remont', copy: 'Mieszkanie, dom, wykończenie wnętrz' },
    { icon: Wrench, title: 'Hydraulika', copy: 'Awaria, instalacja, łazienka' },
    { icon: Zap, title: 'Elektryka', copy: 'Instalacje, oświetlenie, pomiary' },
  ];
  const customerSteps = [
    'Dodajesz zlecenie w 60 sekund: co, gdzie i kiedy — na przykład „położenie płytek 20 m², Poznań, na już” — i możesz dodać 2 zdjęcia łazienki.',
    'Dostajesz powiadomienia od dostępnych fachowców w okolicy.',
    'Porównujesz profile, oceny i realizacje, a następnie wybierasz najlepszego fachowca.',
    'Kontaktujecie się na czacie w aplikacji — bez udostępniania numeru do czasu wyboru.',
  ];
  const contractorSteps = [
    'Widzisz tylko zlecenia z Twojej branży i miasta — zero spamu.',
    'Masz od razu dostęp do zdjęć i budżetu klienta.',
    'Odpowiadasz jednym kliknięciem i zdobywasz klienta bez prowizji za leady na start.',
    'Budujesz profil z opiniami i zdjęciami realizacji.',
  ];
  const benefits = [
    { icon: Clock3, title: 'Szybko', copy: 'Pierwsze oferty w kilkanaście minut.' },
    { icon: MapPin, title: 'Lokalnie', copy: 'Tylko fachowcy z Twojej okolicy.' },
    { icon: ShieldCheck, title: 'Bezpiecznie', copy: 'Profile z ocenami, historią i zdjęciami prac.' },
    { icon: Camera, title: 'Ze zdjęciem', copy: 'Dodaj fotę usterki — fachowiec od razu wie co i za ile.' },
    { icon: Wrench, title: 'Wszystkie branże', copy: 'Hydraulik, elektryk, płytkarz, malarz, stolarz, brukarz, dachy, wykończenia, złota rączka i 40+ innych.' },
  ];
  return <div data-health-status={healthStatus} className="min-h-[100dvh] overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    {hasAnnouncement && <div className="absolute inset-x-0 top-0 z-50 h-[36px] bg-[hsl(var(--primary))] px-4 py-2.5 text-center text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="site-announcement">{settings.announcement}</div>}
    <PublicHeader style={{ top: hasAnnouncement ? '36px' : '0' }} />
    <section className="relative overflow-hidden px-5 pb-20 pt-[138px] md:px-12 md:pb-28 md:pt-[166px]">
      <div className="absolute -right-24 top-16 size-[480px] rounded-full bg-[hsl(var(--primary)/.16)] blur-3xl" /><div className="absolute -left-24 bottom-0 size-[300px] rounded-full bg-[hsl(var(--secondary)/.62)] blur-3xl" />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
        <div className="rise-in"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--secondary-foreground))]"><span className="size-1.5 rounded-full bg-[hsl(var(--primary))]" /> Lokalnie. Konkretnie. Po sąsiedzku.</div>
          <h1 className="max-w-[700px] font-[var(--app-font-serif)] text-[clamp(3.2rem,7vw,6.6rem)] font-bold leading-[.92] tracking-[-.065em]">Dobry fachowiec<br /><span className="text-[hsl(var(--primary))]">zaczyna się</span><br />od dobrego briefu.</h1>
          <p className="mt-7 max-w-[510px] text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">Publikuj potrzeby remontowe bez chaosu. Znajduj zlecenia, które pasują do Twoich umiejętności i lokalizacji.</p>
          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row"><Link href="/auth" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(var(--foreground)/.16)] transition hover:-translate-y-0.5" data-testid="link-hero-primary">Opisz swoje zlecenie <ArrowRight size={17} /></Link><Link href="/requests" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3.5 text-sm font-bold transition hover:border-[hsl(var(--primary))]" data-testid="link-hero-secondary">Przeglądaj zlecenia <Compass size={16} /></Link></div>
          <div className="mt-11 flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]"><div className="flex -space-x-2">{['K', 'M', 'A', 'P'].map((x, i) => <span key={x} className={`grid size-8 place-items-center rounded-full border-2 border-[hsl(var(--background))] text-xs font-bold ${['bg-[#d39b70]', 'bg-[#8aa59b]', 'bg-[#c87858]', 'bg-[#d0b46b]'][i]}`}>{x}</span>)}</div><span><strong className="text-[hsl(var(--foreground))]">1 200+</strong> osób działa już lokalnie</span></div>
        </div>
        <div className="relative mx-auto w-full max-w-[500px] rise-in delay-2"><div className="absolute -left-5 top-10 hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-lg sm:block"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><BadgeCheck size={15} className="text-[hsl(var(--secondary-foreground))]" /> Zweryfikowany profil</div><div className="h-1.5 w-28 rounded-full bg-[hsl(var(--secondary))]" /></div>
          <div className="relative overflow-hidden rounded-[28px] border border-[hsl(var(--foreground)/.1)] bg-[hsl(var(--sidebar))] p-5 shadow-[14px_18px_0_hsl(var(--foreground)/.08)] blueprint-grid sm:p-7"><div className="absolute right-0 top-0 size-40 rounded-full bg-[hsl(var(--primary)/.2)] blur-3xl" /><div className="relative mb-6 flex items-center justify-between text-[hsl(var(--sidebar-foreground))]"><span className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--sidebar-foreground)/.6)]">Przykładowe zlecenie</span><span className="rounded-full bg-[hsl(var(--primary)/.18)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--primary))]">NOWE</span></div>
            <div className="relative rounded-2xl bg-[hsl(var(--card))] p-5 text-[hsl(var(--foreground))]"><div className="mb-4 flex items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--secondary-foreground))]"><Hammer size={14} /> REMONT</div><h3 className="font-[var(--app-font-serif)] text-2xl font-bold tracking-tight">Odświeżenie<br />mieszkania 62 m²</h3></div><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--primary)/.16)] text-[hsl(var(--primary))]"><HomeIcon size={19} /></span></div><p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Szukam solidnej ekipy do malowania i drobnych prac wykończeniowych.</p><div className="mt-6 grid grid-cols-2 gap-2 border-t border-[hsl(var(--border))] pt-4 text-xs"><span className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]"><MapPin size={14} /> Kraków, Podgórze</span><strong className="text-right">12–18 tys. zł</strong></div></div>
            <div className="relative mt-4 flex items-center justify-between rounded-xl bg-[hsl(var(--sidebar-accent))] px-4 py-3 text-[hsl(var(--sidebar-foreground))]"><span className="flex items-center gap-2 text-xs"><Clock3 size={14} className="text-[hsl(var(--primary))]" /> opublikowano 2h temu</span><ArrowRight size={16} className="text-[hsl(var(--primary))]" /></div></div>
        </div>
      </div>
    </section>
    <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] px-5 py-7 md:px-12"><div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6"><p className="text-sm font-bold text-[hsl(var(--muted-foreground))]">Jedno miejsce dla prac, które mają znaczenie</p><div className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-bold text-[hsl(var(--foreground)/.72)]"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-[hsl(var(--secondary-foreground))]" /> Bezpieczny kontakt</span><span className="flex items-center gap-2"><MapPin size={16} className="text-[hsl(var(--primary))]" /> W Twojej okolicy</span><span className="flex items-center gap-2"><MessageCircle size={16} className="text-[hsl(var(--accent))]" /> Bez zbędnych telefonów</span></div></div></section>
    <section className="px-5 py-20 md:px-12 md:py-28"><div className="mx-auto max-w-[1240px]"><div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Jasny początek</p><h2 className="max-w-[620px] font-[var(--app-font-serif)] text-4xl font-bold leading-tight tracking-tight md:text-5xl">Dla tych, którzy chcą zrobić to porządnie.</h2></div><p className="max-w-[330px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Bez katalogu obietnic. Z konkretnym zakresem, budżetem i lokalizacją od pierwszej wiadomości.</p></div><div className="grid gap-4 md:grid-cols-3">{examples.map(({ icon: Icon, title, copy }, i) => <div key={title} className={`rise-in delay-${i + 1} group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition hover:-translate-y-1 hover:border-[hsl(var(--primary)/.55)] hover:shadow-lg`}><span className="mb-12 grid size-11 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--secondary-foreground))] transition group-hover:bg-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary-foreground))]"><Icon size={20} /></span><h3 className="font-[var(--app-font-serif)] text-2xl font-bold">{title}</h3><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{copy}</p><ChevronRight size={18} className="mt-6 text-[hsl(var(--primary))]" /></div>)}</div></div></section>
     <section id="jak-to-dziala" className="bg-[hsl(var(--secondary))] px-5 py-20 md:px-12 md:py-28">
       <div className="mx-auto max-w-[1240px]">
         <div className="mb-12 max-w-[650px]">
           <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Jak to działa?</p>
           <h2 className="font-[var(--app-font-serif)] text-4xl font-bold leading-tight tracking-tight md:text-5xl">Prosto od zlecenia<br />do dobrej realizacji.</h2>
         </div>
         <div className="grid gap-5 lg:grid-cols-2">
           {[
             { label: 'Jesteś klientem', icon: HomeIcon, steps: customerSteps },
             { label: 'Jesteś fachowcem', icon: Wrench, steps: contractorSteps },
           ].map(({ label, icon: Icon, steps }) => (
             <div key={label} className="rounded-3xl bg-[hsl(var(--card)/.72)] p-6 md:p-8">
               <div className="mb-7 flex items-center gap-3">
                 <span className="grid size-11 place-items-center rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"><Icon size={20} /></span>
                 <h3 className="font-[var(--app-font-serif)] text-2xl font-bold">{label}</h3>
               </div>
               <ol className="space-y-5">
                 {steps.map((step, index) => (
                   <li key={step} className="flex gap-4 border-t border-[hsl(var(--border))] pt-4">
                     <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--primary-foreground))]">{index + 1}</span>
                     <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{step}</p>
                   </li>
                 ))}
               </ol>
             </div>
           ))}
         </div>
       </div>
     </section>
     <section className="px-5 py-20 md:px-12 md:py-28">
       <div className="mx-auto max-w-[1240px]">
         <div className="mb-12 max-w-[680px]">
           <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Dlaczego Zleć Majstra?</p>
           <h2 className="font-[var(--app-font-serif)] text-4xl font-bold leading-tight tracking-tight md:text-5xl">Mniej nerwów.<br />Więcej konkretów.</h2>
         </div>
         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
           {benefits.map(({ icon: Icon, title, copy }) => (
             <div key={title} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition hover:-translate-y-1 hover:border-[hsl(var(--primary)/.55)] hover:shadow-lg">
               <Icon size={21} className="mb-10 text-[hsl(var(--primary))]" />
               <h3 className="font-[var(--app-font-serif)] text-xl font-bold">{title}</h3>
               <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{copy}</p>
             </div>
           ))}
         </div>
       </div>
     </section>
      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] px-5 py-20 md:px-12 md:py-24" aria-labelledby="service-search-heading">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Usługi remontowe lokalnie</p>
            <h2 id="service-search-heading" className="font-[var(--app-font-serif)] text-4xl font-bold leading-tight tracking-tight md:text-5xl">Fachowiec, majster lub ekipa remontowa — konkretnie.</h2>
          </div>
          <div>
            <p className="text-base leading-relaxed text-[hsl(var(--muted-foreground))]">Szukasz wykonawcy do remontu? Na Zleć Majstra znajdziesz hydraulika, elektryka, płytkarza i specjalistę od malowania oraz wykończenia wnętrz. Publikuj zlecenia budowlane albo dołącz jako fachowiec i zdobywaj prace w swojej okolicy.</p>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-[hsl(var(--muted-foreground))]">Od drobnych napraw dla złotej rączki po kompleksowy remont mieszkania — opis, budżet i lokalizacja są jasne od początku.</p>
          </div>
        </div>
      </section>
     <section className="bg-[hsl(var(--sidebar))] px-5 py-20 text-center text-[hsl(var(--sidebar-foreground))] md:px-12 md:py-24">
       <div className="mx-auto max-w-[760px]">
         <Sparkles className="mx-auto mb-5 text-[hsl(var(--primary))]" size={26} />
         <h2 className="font-[var(--app-font-serif)] text-4xl font-bold tracking-tight md:text-6xl">Przestań szukać.<br /><span className="text-[hsl(var(--primary))]">Zacznij zlecać.</span></h2>
         <p className="mx-auto mt-5 max-w-[540px] text-base leading-relaxed text-[hsl(var(--sidebar-foreground)/.68)]">Pobierz Zleć Majstra i ogarnij remont bez nerwów.</p>
         <Link href="/auth" className="focus-ring mt-8 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5" data-testid="link-bottom-cta">Zacznij teraz <ArrowRight size={16} /></Link>
       </div>
     </section>
     <footer className="border-t border-[hsl(var(--border))] px-5 py-8 md:px-12">
       <div className="mx-auto flex max-w-[1240px] flex-col gap-5 text-xs text-[hsl(var(--muted-foreground))]">
         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><Logo /><span>© 2024 Zleć Majstra. Praktycznie po sąsiedzku.</span><span className="flex flex-wrap gap-4"><Link href="/politykaprywatnosci" data-testid="link-privacy">Prywatność</Link><Link href="/regulamin" data-testid="link-terms">Regulamin</Link><Link href="/regulamin-pakietu" data-testid="link-premium-terms">Regulamin Premium</Link><button data-testid="button-help">Pomoc</button></span></div>
         <div className="border-t border-[hsl(var(--border))] pt-4 leading-relaxed">Administrator: MM Renowacje Monika Marcinkowska, ul. Kawiary 25/19, 62-200 Gniezno, NIP: 784 223 68 76, Regon: 521376510</div>
       </div>
     </footer>
  </div>;
}

function AuthPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [role, setRole] = useState<'customer' | 'contractor'>('customer');
  const [submitted, setSubmitted] = useState(false);
  const roleOptions: Array<{ value: 'customer' | 'contractor'; label: string; Icon: typeof HomeIcon }> = [
    { value: 'customer', label: 'Zleceniodawca', Icon: HomeIcon },
    { value: 'contractor', label: 'Fachowiec', Icon: Wrench }
  ];
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (mode === 'register') setMode('verify'); else { localStorage.setItem('zr-role', role); setLocation('/dashboard'); } };
  return <div className="grid min-h-[100dvh] bg-[hsl(var(--background))] md:grid-cols-[.85fr_1.15fr]"><div className="hidden bg-[hsl(var(--sidebar))] p-12 text-[hsl(var(--sidebar-foreground))] md:flex md:flex-col"><Logo light /><div className="mt-auto max-w-[430px]"><div className="mb-5 grid size-12 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><KeyRound size={22} /></div><h1 className="font-[var(--app-font-serif)] text-5xl font-bold leading-[.98] tracking-tight">Dobre decyzje<br />zaczynają się<br /><span className="text-[hsl(var(--primary))]">od konkretów.</span></h1><p className="mt-6 max-w-[330px] text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.65)]">Twoje zlecenia, kontakty i prace w jednym spokojnym miejscu.</p></div><div className="mt-auto flex gap-3 pt-16 text-xs text-[hsl(var(--sidebar-foreground)/.48)]"><ShieldCheck size={15} /> Dane chronione i traktowane poważnie</div></div><div className="flex flex-col px-5 py-8 sm:px-12 md:justify-center md:px-[clamp(2rem,8vw,9rem)]"><div className="mb-16 md:hidden"><Logo /></div><div className="mx-auto w-full max-w-[440px]">{mode !== 'verify' && <><Link href="/" className="mb-10 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-home">← Wróć na stronę główną</Link><div className="mb-8 flex rounded-xl bg-[hsl(var(--muted))] p-1"><button onClick={() => setMode('login')} className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${mode === 'login' ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid="tab-login">Logowanie</button><button onClick={() => setMode('register')} className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${mode === 'register' ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid="tab-register">Rejestracja</button></div><h2 className="font-[var(--app-font-serif)] text-4xl font-bold tracking-tight">{mode === 'login' ? 'Dobrze Cię widzieć.' : 'Zacznijmy od planu.'}</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{mode === 'login' ? 'Zaloguj się do swojej przestrzeni.' : 'Załóż konto w mniej niż minutę.'}</p></>}{mode === 'verify' ? <div className="rise-in"><div className="mb-6 grid size-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><Mail size={24} /></div><h2 className="font-[var(--app-font-serif)] text-4xl font-bold tracking-tight">Sprawdź swoją skrzynkę.</h2><p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Wysłaliśmy link weryfikacyjny na podany adres. Po potwierdzeniu możesz się zalogować.</p><Button className="mt-8 w-full" onClick={() => setMode('login')} data-testid="button-back-to-login">Wróć do logowania</Button></div> : <form onSubmit={submit} className="mt-8 space-y-5"><div><span className="mb-2 block text-[12px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">{mode === 'login' ? 'Zaloguj jako (demo)' : 'Jestem tutaj jako'}</span><div className="grid grid-cols-3 gap-2">{roleOptions.map(({ value, label, Icon }) => <button type="button" key={value} onClick={() => setRole(value)} className={`focus-ring flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${role === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`} data-testid={`button-role-${value}`}><Icon size={15} /><span className="hidden sm:inline">{label}</span></button>)}</div></div>{mode === 'register' && <div className="grid grid-cols-2 gap-3"><Field required label="Imię" placeholder="np. Anna" data-testid="input-first-name" /><Field required label="Nazwisko" placeholder="np. Nowak" data-testid="input-last-name" /></div>}{mode === 'register' && role === 'contractor' && <div className="space-y-4 rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.06)] p-4"><div><p className="text-sm font-bold text-[hsl(var(--foreground))]">Dane firmy</p><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Fachowcy podają adres firmy i NIP, aby klienci wiedzieli, z kim współpracują.</p></div><Field required label="Adres firmy" placeholder="ul. Rzemieślnicza 12, 00-001 Warszawa" data-testid="input-company-address" /><Field required label="NIP" placeholder="1234567890" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} data-testid="input-nip" /></div>}<Field required type="email" label="Adres e-mail" placeholder="ty@przyklad.pl" data-testid="input-email" /><Field required type="password" label="Hasło" placeholder="Minimum 8 znaków" data-testid="input-password" />{mode === 'login' && <div className="flex justify-end"><button type="button" onClick={() => setSubmitted(true)} className="text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:underline" data-testid="button-forgot-password">Nie pamiętam hasła</button></div>}{submitted && <div className="rounded-xl bg-[hsl(var(--secondary))] p-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">Jeśli konto istnieje, wyślemy instrukcję na Twój e-mail.</div>}<Button type="submit" className="w-full" data-testid="button-submit-auth">{mode === 'login' ? <><LogIn size={16} /> Zaloguj się</> : <>Utwórz konto <ArrowRight size={16} /></>}</Button><p className="text-center text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Kontynuując, akceptujesz regulamin i politykę prywatności.</p></form>}</div></div></div>;
}

function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.17em] text-[hsl(var(--primary))]">{eyebrow}</p><h1 className="font-[var(--app-font-serif)] text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>{copy && <p className="mt-3 max-w-[590px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{copy}</p>}</div>{action}</div>;
}

function LoadingState({ lines = 3 }: { lines?: number }) {
  return <div className="space-y-3" data-testid="state-loading">{Array.from({ length: lines }).map((_, i) => <div key={i} className="skeleton h-[88px] rounded-2xl" />)}</div>;
}
function ErrorState({ message = 'Nie udało się pobrać danych.' }: { message?: string }) {
  return <div className="rounded-2xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)] p-8 text-center" data-testid="state-error"><CircleAlert className="mx-auto text-[hsl(var(--destructive))]" /><p className="mt-3 text-sm font-bold">{message}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Spróbuj odświeżyć stronę za chwilę.</p></div>;
}
function RenewalReminder({ reminder, onRenew, isPending, error }: { reminder: SubscriptionRenewalReminder; onRenew: () => void; isPending: boolean; error?: string }) {
  return <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[hsl(var(--primary)/.38)] bg-[hsl(var(--primary)/.1)] p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="renewal-reminder"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Bell size={18} /></span><div><p className="text-sm font-bold">Zbliża się koniec dostępu</p><p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{reminder.message}</p><p className="mt-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Dostęp do {new Date(reminder.accessExpiresAt).toLocaleDateString('pl-PL')}.</p>{error && <p className="mt-2 text-xs font-bold text-[hsl(var(--destructive))]">{error}</p>}</div></div><Button onClick={onRenew} disabled={isPending} className="shrink-0" data-testid="button-renew-subscription">{isPending ? 'Łączymy z PayU…' : 'Odnów przez PayU'} <ArrowRight size={15} /></Button></div>;
}

function useSessionProfile() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const profileQuery = useGetMyProfile({
    query: {
      queryKey: getSessionProfileQueryKey(userId),
      enabled: isLoaded && Boolean(isSignedIn && userId),
      retry: false,
    },
  });
  const storedRole = localStorage.getItem('zr-role');
  const role = storedRole === 'contractor' ? 'contractor' : 'customer';
  const profile: Profile = profileQuery.data ?? {
    id: userId ?? '',
    role: role as Profile['role'],
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: null,
    companyAddress: null,
    serviceLocation: null,
    nip: null,
    profileImageUrl: null,
    verified: false,
  };
  return {
    profile,
    isLoading: !isLoaded || Boolean(isSignedIn && profileQuery.isPending),
    isError: Boolean(isSignedIn && profileQuery.isError),
  };
}

function RoleProfile() {
  return useSessionProfile().profile;
}

function Dashboard() {
  const profile = RoleProfile();
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), retry: false } });
  const { data: subscription } = useGetSubscription({ query: { queryKey: getGetSubscriptionQueryKey(), retry: false, enabled: profile.role === 'contractor' } });
  const summary = data ?? demoSummary;
  const renew = () => setLocation('/billing');
  return <AppShell profile={profile}><PageHeading eyebrow="Pulpit" title={`Dzień dobry, ${profile.firstName}.`} copy={profile.role === 'contractor' ? 'Tu znajdziesz najważniejsze informacje o rynku i swoich aktywnościach.' : 'Masz dobry plan. Zobacz, co dzieje się z Twoimi zleceniami.'} action={profile.role === 'customer' ? <Link href="/requests/new" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(var(--foreground)/.14)] transition hover:-translate-y-0.5" data-testid="link-new-request"><Plus size={17} /> Dodaj zlecenie</Link> : <Link href="/requests" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(var(--foreground)/.14)] transition hover:-translate-y-0.5" data-testid="link-browse-requests"><Search size={16} /> Przeglądaj zlecenia</Link>} />{profile.role === 'contractor' && subscription?.renewalReminder && <RenewalReminder reminder={subscription.renewalReminder} onRenew={renew} isPending={false} />}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: profile.role === 'contractor' ? 'Otwarte zlecenia' : 'Otwarte moje', value: summary.openRequests, icon: BriefcaseBusiness, tone: 'primary' }, { label: 'Moje zlecenia', value: summary.myRequests, icon: Pencil, tone: 'secondary' }, { label: 'Nowe w tym tygodniu', value: summary.newThisWeek, icon: Sparkles, tone: 'accent' }, { label: 'Odblokowane kontakty', value: summary.unlockedContacts, icon: LockKeyhole, tone: 'dark' }].map(({ label, value, icon: Icon, tone }, i) => <div key={label} className={`rise-in delay-${i + 1} rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5`} data-testid={`metric-${i}`}><div className="flex items-start justify-between"><span className={`grid size-9 place-items-center rounded-xl ${tone === 'primary' ? 'bg-[hsl(var(--primary)/.17)] text-[hsl(var(--primary))]' : tone === 'secondary' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]' : tone === 'accent' ? 'bg-[hsl(var(--accent)/.15)] text-[hsl(var(--accent))]' : 'bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]'}`}><Icon size={17} /></span><span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">30 dni</span></div><p className="mt-7 text-3xl font-bold tracking-tight">{isLoading ? '—' : value}</p><p className="mt-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">{label}</p></div>)}</div>{isError && <div className="mt-4"><ErrorState /></div>}<div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-7"><div className="flex items-center justify-between"><div><h2 className="font-[var(--app-font-serif)] text-2xl font-bold">Ruch na platformie</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Najczęściej wybierane kategorie</p></div><Tag className="text-[hsl(var(--primary))]" size={20} /></div><div className="mt-8 space-y-5">{(summary.topCategories ?? demoSummary.topCategories ?? []).map((item, i) => <div key={item.category} data-testid={`category-stat-${i}`}><div className="mb-2 flex justify-between text-sm"><span className="font-bold">{categoryLabels[item.category] ?? item.category}</span><span className="text-[hsl(var(--muted-foreground))]">{item.count} zleceń</span></div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className={`h-full rounded-full ${i === 0 ? 'bg-[hsl(var(--primary))]' : i === 1 ? 'bg-[hsl(var(--secondary-foreground))]' : 'bg-[hsl(var(--accent))]'}`} style={{ width: `${Math.min(100, 25 + item.count * 3)}%` }} /></div></div>)}</div></div><div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))] blueprint-grid"><div className="relative"><div className="mb-8 grid size-10 place-items-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Star size={18} /></div><h2 className="font-[var(--app-font-serif)] text-2xl font-bold">Twój profil robi różnicę.</h2><p className="mt-3 text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.65)]">Uzupełnij informacje, żeby łatwiej budować zaufanie od pierwszej wiadomości.</p><Link href="/profile" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-profile-prompt">Uzupełnij profil <ArrowRight size={15} /></Link></div></div></div></AppShell>;
}

function RequestCard({ request }: { request: JobRequest }) {
  const Icon = categoryIcons[request.category] ?? Hammer;
  return <Link href={`/requests/${request.id}`} className="group block overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.7)] hover:shadow-lg" data-testid={`card-request-${request.id}`}>
    {request.photos?.length ? <div className="grid h-44 grid-cols-3 gap-0.5 bg-[hsl(var(--muted))]" data-testid={`request-photos-${request.id}`}>
      {request.photos.slice(0, 3).map((photo, index) => <div key={`${photo}-${index}`} className={`relative overflow-hidden ${request.photos?.length === 1 ? 'col-span-3' : index === 0 ? 'col-span-2' : ''}`}>
        <img src={photo} alt={`Zdjęcie prac do wykonania ${index + 1}`} className="size-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        {index === 2 && request.photos && request.photos.length > 3 && <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-bold text-white">+{request.photos.length - 3}</span>}
      </div>)}
    </div> : null}
    <div className="p-5">
      <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--secondary-foreground))] transition group-hover:bg-[hsl(var(--primary)/.15)] group-hover:text-[hsl(var(--primary))]"><Icon size={18} /></span><div><div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]"><span>{categoryLabels[request.category] ?? legacyCategoryLabels[request.category] ?? request.category}</span><span className="size-1 rounded-full bg-[hsl(var(--border))]" /><span>{new Date(request.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span></div><h3 className="font-[var(--app-font-serif)] text-xl font-bold leading-tight">{request.title}</h3></div></div><ChevronRight size={18} className="mt-1 shrink-0 text-[hsl(var(--muted-foreground))] transition group-hover:translate-x-1 group-hover:text-[hsl(var(--primary))]" /></div>
      <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{request.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[hsl(var(--border))] pt-4 text-xs font-semibold text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-1.5"><MapPin size={14} /> {request.location}</span><span className="font-bold text-[hsl(var(--foreground))]">{request.budget}</span><span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold ${request.status === 'open' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{statusLabels[request.status]}</span></div>
    </div>
  </Link>;
}

function Requests() {
  const profile = RoleProfile();
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ ...(category !== 'all' ? { category: requestCategories.find((item) => item.label === category)?.value ?? category } : {}), ...(status !== 'all' ? { status } : {}), ...(profile.role === 'customer' ? { mine: true } : {}) }), [category, status, profile.role]);
  const { data, isLoading, isError } = useListRequests(params, { query: { queryKey: getListRequestsQueryKey(params), retry: false } });
  const notifications = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      refetchInterval: 10000,
      refetchOnMount: 'always',
      retry: false,
    },
  });
  const requests = (data ?? demoRequests).filter((r) => `${r.title} ${r.location} ${r.description}`.toLowerCase().includes(search.toLowerCase()));
  return <AppShell profile={profile}><PageHeading eyebrow={profile.role === 'contractor' ? 'Rynek zleceń' : 'Twoje prace'} title={profile.role === 'contractor' ? 'Zlecenia dla Ciebie.' : 'Twoje zlecenia.'} copy={profile.role === 'contractor' ? 'Przeglądaj konkretnie opisane prace w Twojej okolicy.' : 'Zarządzaj opublikowanymi prośbami i sprawdzaj ich status.'} action={profile.role === 'customer' ? <Link href="/requests/new" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-requests-new"><Plus size={17} /> Nowe zlecenie</Link> : undefined} /><MessagesSummary notifications={notifications.data?.notifications ?? []} unreadCount={notifications.data?.unreadConversations ?? 0} /><div className="mb-7 flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3.5 top-3.5 text-[hsl(var(--muted-foreground))]" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj po tytule, mieście lub opisie" className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-10 pr-4 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-search-requests" /></label><div className="flex gap-2"><select value={category} onChange={(e) => setCategory(e.target.value)} className="focus-ring h-11 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-semibold outline-none" data-testid="select-category-filter"><option value="all">Wszystkie</option>{requestCategories.map(({ value, label }) => <option key={value} value={label}>{label}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className="focus-ring h-11 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-semibold outline-none" data-testid="select-status-filter"><option value="all">Każdy status</option><option value="open">Otwarte</option><option value="in_progress">W realizacji</option><option value="completed">Zakończone</option></select></div></div><div className="mb-4 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{requests.length} {requests.length === 1 ? 'zlecenie' : 'zleceń'}</p><button className="flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-filter-more"><ListFilter size={15} /> Filtry</button></div>{isLoading ? <LoadingState /> : isError ? <ErrorState /> : requests.length ? <div className="grid gap-3">{requests.map((request) => <RequestCard key={request.id} request={request} />)}</div> : <EmptyRequests role={profile.role} />}</AppShell>;
}

function Messages() {
  const profile = RoleProfile();
  const notifications = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      refetchInterval: 10000,
      refetchOnMount: 'always',
      retry: false,
    },
  });
  const items = notifications.data?.notifications ?? [];
  const unreadCount = notifications.data?.unreadConversations ?? 0;

  return <AppShell profile={profile}>
    <PageHeading
      eyebrow="Komunikator"
      title="Wiadomości."
      copy="Rozmawiaj bezpiecznie w sprawie konkretnych zleceń."
    />
    <section className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-testid="messages-page">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
        <div>
          <h2 className="text-base font-bold">Twoje rozmowy</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'nieprzeczytana rozmowa' : 'nieprzeczytane rozmowy'}` : 'Wszystkie rozmowy są przeczytane'}
          </p>
        </div>
        <MessageCircle size={20} className="text-[hsl(var(--primary))]" />
      </div>
      {items.length > 0 ? (
        <div className="divide-y divide-[hsl(var(--border))]">
          {items.map((notification) => (
            <Link
              key={notification.conversationId}
              href={`/requests/${notification.requestId}?conversationId=${notification.conversationId}`}
              className="flex items-center gap-4 px-5 py-4 transition hover:bg-[hsl(var(--muted)/.55)]"
              data-testid={`messages-page-item-${notification.conversationId}`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]">
                <MessageCircle size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">{notification.title}</strong>
                <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{notification.body}</span>
                <time className="mt-2 block text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{new Date(notification.createdAt).toLocaleString('pl-PL')}</time>
              </span>
              <ChevronRight size={17} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-5 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            <MessageCircle size={25} />
          </span>
          <h2 className="mt-4 font-[var(--app-font-serif)] text-2xl font-bold">Brak nowych wiadomości</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            Gdy ktoś skontaktuje się z Tobą w sprawie zlecenia, rozmowa pojawi się tutaj.
          </p>
        </div>
      )}
    </section>
  </AppShell>;
}

function MessagesSummary({ notifications, unreadCount }: { notifications: ConversationNotification[]; unreadCount: number }) {
  return <section className="mb-7 overflow-hidden rounded-2xl border border-[hsl(var(--primary)/.28)] bg-[hsl(var(--primary)/.06)]" data-testid="messages-summary">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[hsl(var(--primary)/.18)] px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--primary)/.16)] text-[hsl(var(--primary))]"><MessageCircle size={19} /></span>
        <div><h2 className="text-sm font-bold">Wiadomości</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'nowa rozmowa' : 'nowe rozmowy'}` : 'Brak nowych wiadomości'}</p></div>
      </div>
      {unreadCount > 0 && <span className="rounded-full bg-[hsl(var(--primary))] px-2.5 py-1 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="requests-unread-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </div>
    {notifications.length > 0 ? <div className="grid gap-2 p-3 sm:grid-cols-2">{notifications.slice(0, 4).map((notification) => <Link key={notification.conversationId} href={`/requests/${notification.requestId}?conversationId=${notification.conversationId}`} className="flex items-center gap-3 rounded-xl bg-[hsl(var(--card))] p-3 transition hover:shadow-sm" data-testid={`requests-message-${notification.conversationId}`}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Mail size={15} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{notification.title}</strong><span className="mt-0.5 block text-[11px] text-[hsl(var(--muted-foreground))]">{notification.body}</span></span><ChevronRight size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" /></Link>)}</div> : <p className="px-5 py-4 text-xs text-[hsl(var(--muted-foreground))]">Nowe kontakty pojawią się tutaj. Otwórz zlecenie, aby przejść do pełnej rozmowy.</p>}
  </section>;
}

function EmptyRequests({ role }: { role: Profile['role'] }) {
  return <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] px-6 py-16 text-center" data-testid="state-empty-requests"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><Compass size={24} /></span><h3 className="mt-5 font-[var(--app-font-serif)] text-2xl font-bold">Na razie pusto.</h3><p className="mx-auto mt-2 max-w-[350px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{role === 'contractor' ? 'Zmień filtry lub wróć później — dobre zlecenia pojawiają się codziennie.' : 'Opublikuj pierwsze zlecenie, żeby rozpocząć rozmowę z fachowcem.'}</p>{role === 'customer' && <Link href="/requests/new" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold" data-testid="link-empty-new-request"><Plus size={16} /> Dodaj zlecenie</Link>}</div>;
}

function NewRequest() {
  const profile = RoleProfile();
  const [, setLocation] = useLocation();
  const create = useCreateRequest();
  const requestUpload = useRequestUploadUrl();
  const [photos, setPhotos] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (uploadingPhotos || create.isPending) return;
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const files = Array.from(
      formElement.querySelector<HTMLInputElement>('[data-testid="input-request-photos"]')?.files ?? [],
    ).slice(0, 2);
    try {
      setNotice('');
      setUploadingPhotos(files.length > 0);
      const uploadedPhotos = await Promise.all(files.map(async (file) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 50 * 1024 * 1024) {
          throw new Error('invalid image');
        }
        const prepared = await requestUpload.mutateAsync({
          data: { name: file.name, size: file.size, contentType: file.type },
        });
        const uploaded = await fetch(prepared.uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!uploaded.ok) throw new Error('upload failed');
        return prepared.objectPath;
      }));
      const request = await create.mutateAsync({
        data: {
          title: String(form.get('title')),
          description: String(form.get('description')),
          category: String(form.get('category')) as JobRequestInput['category'],
          location: String(form.get('location')),
          address: String(form.get('address')),
          budget: String(form.get('budget')),
          photos: uploadedPhotos,
        },
      });
      setLocation(`/requests/${request.id}`);
    } catch {
      setNotice('Nie udało się przesłać zdjęć lub opublikować zlecenia. Użyj JPG, PNG lub WebP do 50 MB.');
    } finally {
      setUploadingPhotos(false);
    }
  };
  return <AppShell profile={profile}><div className="mx-auto max-w-[800px]"><Link href="/requests" className="mb-7 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-requests">← Wróć do zleceń</Link><PageHeading eyebrow="Nowe zlecenie" title="Opowiedz, czego potrzebujesz." copy="Dobry opis pomaga właściwym fachowcom szybciej zrozumieć zakres pracy." /><form onSubmit={submit} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-8"><div className="grid gap-5 md:grid-cols-2"><div className="md:col-span-2"><Field required label="Tytuł zlecenia" name="title" placeholder="np. Remont łazienki w mieszkaniu 45 m²" data-testid="input-request-title" /></div><label className="block space-y-1.5"><span className="text-[12px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">Branża</span><select name="category" required className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3.5 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="select-request-category">{Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><Field required label="Miejscowość" name="location" placeholder="np. Gdańsk" data-testid="input-request-location" /><div className="md:col-span-2"><Field required label="Adres zlecenia" name="address" placeholder="np. ul. Długa 10, 80-001 Gdańsk" data-testid="input-request-address" /><p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">Dokładny adres zobaczy fachowiec dopiero po udostępnieniu mu danych kontaktowych.</p></div><Field required label="Orientacyjny budżet" name="budget" placeholder="np. 12 000–18 000 zł" data-testid="input-request-budget" /><div className="md:col-span-2"><label className="block space-y-1.5"><span className="text-[12px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">Opis prac</span><textarea required minLength={10} name="description" rows={6} placeholder="Co dokładnie trzeba zrobić? Jaki jest stan obecny, termin i ważne szczegóły?" className="focus-ring w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3.5 py-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="textarea-request-description" /></label></div><div className="md:col-span-2"><span className="mb-2 block text-[12px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">Zdjęcia <span className="font-normal normal-case tracking-normal">(opcjonalnie)</span></span><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[hsl(var(--input))] p-4 transition hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.05)]"><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Plus size={18} /></span><span><strong className="block text-sm">Dodaj zdjęcia miejsca</strong><small className="text-xs text-[hsl(var(--muted-foreground))]">PNG, JPG do 10 MB</small></span><input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setPhotos(Array.from(e.target.files ?? []).map((file) => file.name))} data-testid="input-request-photos" /></label>{photos.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{photos.map((photo) => <span key={photo} className="rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1.5 text-xs font-semibold">{photo}</span>)}</div>}</div></div>{notice && <p className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-sm font-semibold text-[hsl(var(--destructive))]">{notice}</p>}<div className="mt-8 flex flex-col-reverse justify-end gap-3 border-t border-[hsl(var(--border))] pt-6 sm:flex-row"><Link href="/requests" className="focus-ring inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="link-cancel-request">Anuluj</Link><Button type="submit" disabled={create.isPending} data-testid="button-submit-request">{create.isPending ? 'Publikowanie…' : <>Opublikuj zlecenie <ArrowRight size={16} /></>}</Button></div></form></div></AppShell>;
}

function RequestDetail() {
  const profile = RoleProfile();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const initialConversationId = new URLSearchParams(window.location.search).get('conversationId');
  const { data, isLoading, isError } = useGetRequest(id, { query: { queryKey: getGetRequestQueryKey(id), retry: false } });
  const request = data ?? demoRequests.find((item) => item.id === id) ?? demoRequests[0];
  const unlock = useUnlockRequestContact();
  const [contact, setContact] = useState<(ContactAccess & { email?: string | null; phone?: string | null }) | null>(null);
  const [notice, setNotice] = useState('');
  const updateRequest = useUpdateRequest();
  if (isLoading) return <AppShell profile={profile}><LoadingState lines={2} /></AppShell>;
  if (isError && !request) return <AppShell profile={profile}><ErrorState /></AppShell>;
  const Icon = categoryIcons[request.category] ?? Hammer;
  const unlocked = !!contact || request.contactAvailable || profile.role === 'customer';
  const advanceRequest = () => {
    const nextStatus = request.status === 'open' ? 'in_progress' : 'completed';
    updateRequest.mutate({ id, data: { status: nextStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
      }
    });
  };
  return <AppShell profile={profile}><div className="mx-auto max-w-[1050px]"><Link href="/requests" className="mb-7 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-request-list">← Wróć do zleceń</Link><div className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--secondary-foreground))]"><Icon size={14} /> {categoryLabels[request.category]}</span><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">{statusLabels[request.status]}</span></div><h1 className="mt-7 max-w-[700px] font-[var(--app-font-serif)] text-4xl font-bold leading-tight tracking-tight md:text-5xl">{request.title}</h1><div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-1.5"><MapPin size={16} className="text-[hsl(var(--primary))]" />{request.location}</span><span className="flex items-center gap-1.5"><Clock3 size={16} />{new Date(request.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div><div className="my-8 h-px bg-[hsl(var(--border))]" /><h2 className="font-[var(--app-font-serif)] text-xl font-bold">Zakres prac</h2><p className="mt-3 whitespace-pre-line text-[15px] leading-8 text-[hsl(var(--muted-foreground))]">{request.description}</p>{request.photos && request.photos.length > 0 && <div className="mt-8"><h2 className="mb-3 font-[var(--app-font-serif)] text-xl font-bold">Zdjęcia</h2><div className="grid grid-cols-2 gap-3">{request.photos.map((photo) => <img key={photo} src={photo} alt="Zdjęcie zlecenia" className="aspect-video rounded-xl object-cover" />)}</div></div>}</div><aside className="space-y-4"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Budżet orientacyjny</p><p className="mt-2 font-[var(--app-font-serif)] text-3xl font-bold">{request.budget}</p><div className="my-5 h-px bg-[hsl(var(--border))]" /><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Zleceniodawca</p><div className="mt-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[hsl(var(--accent))] text-sm font-bold text-[hsl(var(--accent-foreground))]">{request.customerName.slice(0, 1)}</span><div><p className="text-sm font-bold">{request.customerName}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">Osoba prywatna</p></div></div></div>{false && profile.role === 'contractor' && <div className={`rounded-2xl p-6 ${unlocked ? 'border border-[hsl(var(--secondary-foreground)/.25)] bg-[hsl(var(--secondary))]' : 'bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] blueprint-grid'}`}>{unlocked ? <><div className="mb-4 flex items-center gap-2 text-[hsl(var(--secondary-foreground))]"><BadgeCheck size={18} /><span className="text-sm font-bold">Kontakt odblokowany</span></div><div className="space-y-3 text-sm font-semibold"><p className="flex items-center gap-2"><Mail size={15} /> {contact?.email ?? request.customerEmail ?? 'kontakt@zleceniodawca.pl'}</p><p className="flex items-center gap-2"><Phone size={15} /> {contact?.phone ?? request.customerPhone ?? '+48 000 000 000'}</p></div></> : <><div className="mb-4 grid size-10 place-items-center rounded-xl bg-[hsl(var(--primary)/.18)] text-[hsl(var(--primary))]"><LockKeyhole size={19} /></div><h3 className="font-[var(--app-font-serif)] text-2xl font-bold">Kontakt jest za zasłoną.</h3><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.65)]">Odblokuj dane, gdy to zlecenie pasuje do Twojej specjalizacji.</p><Button className="mt-5 w-full" onClick={() => unlock.mutate({ id }, { onSuccess: (result) => setContact(result), onError: () => setNotice('Aby odblokować kontakt, aktywuj abonament Profesjonalista.') })} disabled={unlock.isPending} data-testid="button-unlock-contact">{unlock.isPending ? 'Odblokowywanie…' : <>Odblokuj kontakt <KeyRound size={15} /></>}</Button>{notice && <p className="mt-3 text-xs font-semibold text-[hsl(var(--primary))]">{notice}</p>}<Link href="/billing" className="mt-4 flex items-center justify-center gap-1 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-detail-billing">Sprawdź abonament <ArrowRight size={13} /></Link></>}</div>}{profile.role === 'customer' && <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-5"><p className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--secondary-foreground))]"><ShieldCheck size={17} /> Twoje zlecenie jest widoczne</p><p className="mt-2 text-xs leading-relaxed text-[hsl(var(--secondary-foreground)/.75)]">Fachowiec z aktywnym abonamentem może rozpocząć z Tobą bezpieczną rozmowę. Dane kontaktowe udostępniasz dopiero, gdy zdecydujesz.</p></div>}</aside></div><RequestConversation requestId={id} profile={profile} initialConversationId={initialConversationId ? Number(initialConversationId) : null} /><RequestStatusActions request={request} role={profile.role} advanceRequest={advanceRequest} pending={updateRequest.isPending} /><RequestReviews request={request} profile={profile} /></div></AppShell>;
}

function RequestEditor({ request }: { request: JobRequest }) {
  const conversations = useListRequestConversations(request.id, { query: { queryKey: getListRequestConversationsQueryKey(request.id), retry: false } });
  const update = useUpdateRequest();
  const [editing, setEditing] = useState(false);
  const locked = conversations.data?.some(item => item.customerContactShared) ?? false;
  if (locked) return <div className="mt-5 rounded-2xl border bg-[hsl(var(--muted)/.4)] p-5 text-sm"><p className="font-bold">Edycja zlecenia zakończona</p><p className="mt-1 text-[hsl(var(--muted-foreground))]">Dane zostały już udostępnione fachowcowi.</p></div>;
  if (!editing) return <Button variant="outline" className="mt-5" onClick={() => setEditing(true)} data-testid="button-edit-request">Edytuj zlecenie</Button>;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({ id: request.id, data: {
      title: String(form.get('title') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      location: String(form.get('location') ?? '').trim(),
      address: String(form.get('address') ?? '').trim(),
      budget: String(form.get('budget') ?? '').trim(),
    } }, { onSuccess: () => { setEditing(false); queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(request.id) }); queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() }); } });
  };
  return <form onSubmit={submit} className="mt-5 grid gap-4 rounded-2xl border bg-[hsl(var(--card))] p-5 md:grid-cols-2" data-testid="form-edit-request">
    <div className="md:col-span-2"><Field required label="Tytuł" name="title" defaultValue={request.title} /></div>
    <Field required label="Miejscowość" name="location" defaultValue={request.location} />
    <Field required label="Budżet" name="budget" defaultValue={request.budget} />
    <div className="md:col-span-2"><Field required label="Dokładny adres" name="address" defaultValue={request.address ?? ''} /></div>
    <label className="space-y-1.5 md:col-span-2"><span className="text-xs font-bold uppercase tracking-wider">Opis</span><textarea name="description" required minLength={10} defaultValue={request.description} rows={5} className="w-full rounded-xl border bg-transparent p-3 text-sm" /></label>
    <div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={update.isPending}>Zapisz zmiany</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Anuluj</Button></div>
  </form>;
}

function RequestPhotoManager({ request }: { request: JobRequest }) {
  const upload = useRequestUploadUrl();
  const update = useUpdateRequest();
  const conversations = useListRequestConversations(request.id, { query: { queryKey: getListRequestConversationsQueryKey(request.id), retry: false } });
  const [notice, setNotice] = useState('');
  const storedPhotoPaths = (request.photos ?? []).flatMap(photo => {
    try {
      const path = /^https?:\/\//.test(photo) ? new URL(photo).pathname : photo;
      const objectPath = path.startsWith('/api/storage/')
        ? path.slice('/api/storage'.length)
        : path;
      return /^\/objects\/uploads\/[a-f0-9-]+$/.test(objectPath) ? [objectPath] : [];
    } catch {
      return [];
    }
  });
  if (conversations.data?.some(item => item.customerContactShared) || storedPhotoPaths.length >= 2) return null;
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      setNotice('');
      const objectPaths = await Promise.all(Array.from(files).slice(0, 2 - storedPhotoPaths.length).map(async file => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 50 * 1024 * 1024) throw new Error('invalid image');
        const prepared = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
        const sent = await fetch(prepared.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!sent.ok) throw new Error('upload failed');
        return prepared.objectPath;
      }));
      await update.mutateAsync({ id: request.id, data: { photos: [...storedPhotoPaths, ...objectPaths] } });
      await queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(request.id) });
      await queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
    } catch {
      setNotice('Nie udało się dodać zdjęć. Użyj JPG, PNG lub WebP do 50 MB.');
    }
  };
  return <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
    <p className="text-sm font-bold">Zdjęcia zlecenia</p>
    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Dodaj zdjęcia także do już opublikowanego zlecenia.</p>
    <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-bold hover:bg-[hsl(var(--muted))]">
      <Camera size={16} />{upload.isPending || update.isPending ? 'Przesyłanie…' : 'Dodaj zdjęcia'}
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={upload.isPending || update.isPending} onChange={event => void addPhotos(event.target.files)} data-testid="input-existing-request-photos" />
    </label>
    {notice && <p className="mt-3 text-xs font-semibold text-[hsl(var(--destructive))]">{notice}</p>}
  </div>;
}

function RequestStatusActions({ request, role, advanceRequest, pending }: { request: JobRequest; role: Profile['role']; advanceRequest: () => void; pending: boolean }) {
  if (role !== 'customer') return null;
  if (request.status === 'completed') return <RequestEditor request={request} />;
  const next = request.status === 'open' ? 'in_progress' : 'completed';
  return <><RequestEditor request={request} /><RequestPhotoManager request={request} /><div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:flex-row sm:items-center" data-testid="panel-status-actions"><div><p className="text-sm font-bold">Aktualizuj status pracy</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Poinformuj fachowców, na jakim etapie jesteś.</p></div><Button variant="outline" onClick={advanceRequest} disabled={pending} data-testid="button-advance-request">{pending ? 'Zapisywanie…' : next === 'in_progress' ? 'Rozpoczęta' : 'Oznacz jako zakończoną'} <Check size={15} /></Button></div></>;
}

function Billing() {
  const profile = RoleProfile();
  const { data } = useGetSubscription({ query: { queryKey: getGetSubscriptionQueryKey(), retry: false } });
  const subscription = data ?? demoSubscription;
  const start = useStartSubscription();
  const [notice, setNotice] = useState('');
  const [consents, setConsents] = useState({
    terms: false,
    digitalService: false,
    recurringPayments: false,
  });
  const [paymentPollingDeadline] = useState(() => Date.now() + 30_000);
  const isPaymentReturn = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('payment') === 'return';
  const returnOrder = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('order') ?? '';
  const paymentReturnTracked = useRef(false);
  const paymentConfirmationTracked = useRef(false);
  const payment = useGetPaymentStatus(returnOrder, { query: { queryKey: getGetPaymentStatusQueryKey(returnOrder), enabled: Boolean(returnOrder), retry: false, refetchInterval: (query) => query.state.error || Date.now() >= paymentPollingDeadline || ['completed', 'canceled', 'failed'].includes(query.state.data?.status ?? '') ? false : 2000 } });
  useEffect(() => {
    if (payment.data?.status === 'completed') {
      void queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
    }
  }, [payment.data?.status]);
  useEffect(() => {
    if (!isPaymentReturn) return;

    const status = payment.data?.status;
    if (status === 'completed' && !paymentConfirmationTracked.current) {
      trackEvent('payment_confirmed', { plan: 'professional', provider: 'payu' });
      paymentConfirmationTracked.current = true;
    }
    if (paymentReturnTracked.current) return;

    if (status && ['completed', 'canceled', 'failed'].includes(status)) {
      trackEvent('payment_returned', { provider: 'payu', result: status });
      paymentReturnTracked.current = true;
    } else if (payment.isError) {
      trackEvent('payment_returned', { provider: 'payu', result: 'error' });
      paymentReturnTracked.current = true;
    } else if (!returnOrder) {
      trackEvent('payment_returned', { provider: 'payu', result: 'missing_order' });
      paymentReturnTracked.current = true;
    }
  }, [isPaymentReturn, payment.data?.status, payment.isError, returnOrder]);
  useEffect(() => {
    if (!isPaymentReturn || !returnOrder || paymentReturnTracked.current) return;

    const timeoutId = window.setTimeout(() => {
      if (!paymentReturnTracked.current) {
        trackEvent('payment_returned', { provider: 'payu', result: 'timeout' });
        paymentReturnTracked.current = true;
      }
    }, Math.max(0, paymentPollingDeadline - Date.now()));

    return () => window.clearTimeout(timeoutId);
  }, [isPaymentReturn, paymentPollingDeadline, returnOrder]);
  const subscribe = () => {
    if (!consents.terms || !consents.digitalService || !consents.recurringPayments) {
      setNotice('Zaznacz wszystkie trzy wymagane zgody, aby przejść do PayU.');
      return;
    }
    setNotice('');
    trackEvent('checkout_started', { plan: 'professional', platform: 'web', provider: 'payu' });
    start.mutate({ data: { plan: 'professional', platform: 'web', acceptTerms: true, acceptDigitalService: true, acceptRecurringPayments: true } }, { onSuccess: (result) => { if (result.redirectUri) window.location.assign(result.redirectUri); else setNotice('Płatność została już przyjęta. Odświeżamy status abonamentu.'); }, onError: () => setNotice('Nie udało się rozpocząć płatności PayU. Spróbuj ponownie.') });
  };
  const statusCopy = {
    active: 'AKTYWNY',
    past_due: 'PŁATNOŚĆ WYMAGA UWAGI',
    canceled: 'ANULOWANY',
    inactive: 'NIEAKTYWNY'
  }[subscription.status];
  const actionLabel = 'Kupuję i płacę PayU';
  const currentPaymentStatus = payment.data?.status ?? subscription.paymentStatus;
  const statusNotice = currentPaymentStatus === 'completed' ? 'Płatność została potwierdzona. Abonament jest aktywny.' : currentPaymentStatus === 'pending' || currentPaymentStatus === 'created' ? 'PayU przetwarza płatność. Dostęp włączy się automatycznie po potwierdzeniu płatności.' : currentPaymentStatus === 'canceled' ? 'Ostatnia płatność została anulowana. Możesz rozpocząć nową.' : currentPaymentStatus === 'failed' ? 'Nie udało się rozpocząć ostatniej płatności. Spróbuj ponownie.' : '';
  const allConsentsAccepted = consents.terms && consents.digitalService && consents.recurringPayments;
  const consentItems = [
    { key: 'terms', content: <>Akceptuję <Link href="/regulamin-pakietu" className="font-bold text-[hsl(var(--primary))] underline underline-offset-2" target="_blank">Regulamin Pakietu Premium</Link>, <Link href="/regulamin" className="font-bold text-[hsl(var(--primary))] underline underline-offset-2" target="_blank">Regulamin Aplikacji</Link> oraz <Link href="/politykaprywatnosci" className="font-bold text-[hsl(var(--primary))] underline underline-offset-2" target="_blank">Politykę Prywatności</Link>.</> },
    { key: 'digitalService', content: <>Wyrażam zgodę na rozpoczęcie świadczenia Pakietu Premium przed upływem 14 dni na odstąpienie i przyjmuję do wiadomości utratę prawa do odstąpienia po skorzystaniu z funkcji Premium.</> },
    { key: 'recurringPayments', content: <>Wyrażam zgodę na zapisanie mojej karty lub metody płatności w PayU i automatyczne cykliczne pobieranie 99,00 zł miesięcznie przez 12 miesięcy.</> },
  ] as const;
  if (!isPaymentReturn) {
    return <AppShell profile={profile}>
      <div className="mx-auto max-w-[920px]">
        <PageHeading
          eyebrow="Pakiet Premium dla fachowców"
          title="Jasne zasady przed płatnością."
          copy="99,00 zł brutto miesięcznie przez 12 miesięcy. Łączny koszt zobowiązania wynosi 1 188,00 zł brutto."
        />
        <div className="grid gap-5 md:grid-cols-[.82fr_1.18fr]">
          <section className="relative overflow-hidden rounded-2xl bg-[hsl(var(--sidebar))] p-7 text-[hsl(var(--sidebar-foreground))] blueprint-grid md:p-9">
            <div className="relative">
              <span className="rounded-full bg-[hsl(var(--primary)/.18)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">PAKIET PREMIUM</span>
              <p className="mt-10 font-[var(--app-font-serif)] text-5xl font-bold">99 zł</p>
              <p className="mt-1 text-sm font-semibold text-[hsl(var(--sidebar-foreground)/.65)]">brutto miesięcznie</p>
              <ul className="mt-8 space-y-4 text-sm font-semibold">
                {['Pierwsza płatność w dniu zakupu', 'Kolejne 11 płatności co miesiąc', 'Zobowiązanie na 12 miesięcy', 'Po 12 miesiącach czas nieokreślony'].map((item) => <li key={item} className="flex items-start gap-3"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Check size={13} /></span>{item}</li>)}
              </ul>
              <p className="mt-8 text-xs leading-relaxed text-[hsl(var(--sidebar-foreground)/.58)]">Płatność obsługuje PayU S.A. Dostęp Premium zostanie uruchomiony dopiero po serwerowym potwierdzeniu płatności.</p>
            </div>
          </section>
          <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8" data-testid="billing-required-consents">
            <h2 className="font-[var(--app-font-serif)] text-2xl font-bold">Wymagane zgody</h2>
            <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Przeczytaj dokumenty i zaznacz wszystkie zgody, aby przejść do PayU.</p>
            <div className="mt-6 space-y-4">
              {consentItems.map(({ key, content }) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--border))] p-4 text-xs leading-relaxed transition hover:border-[hsl(var(--primary)/.6)]">
                <input
                  type="checkbox"
                  checked={consents[key]}
                  onChange={(event) => setConsents((current) => ({ ...current, [key]: event.target.checked }))}
                  className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
                  data-testid={`checkbox-${key}`}
                />
                <span>{content}</span>
              </label>)}
            </div>
            {notice && <p className="mt-4 text-xs font-semibold text-[hsl(var(--destructive))]" role="alert">{notice}</p>}
            <Button
              onClick={subscribe}
              disabled={start.isPending || !allConsentsAccepted}
              className="mt-6 w-full"
              data-testid="button-start-subscription"
            >
              {start.isPending ? 'Łączymy z PayU…' : actionLabel} <ArrowRight size={16} />
            </Button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Klikając przycisk, składasz zamówienie z obowiązkiem zapłaty.</p>
          </section>
        </div>
      </div>
    </AppShell>;
  }
  return <AppShell profile={profile}><div className="mx-auto max-w-[920px]"><PageHeading eyebrow="Abonament dla fachowców" title="Płać za dostęp, nie za szum." copy="Jeden plan. Jasne zasady. Odblokowujesz kontakty tylko wtedy, gdy widzisz dobre zlecenie." />{statusNotice && <div className="mb-5 rounded-xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.08)] p-4 text-sm font-semibold" data-testid="billing-status-notice">{statusNotice}</div>}{subscription.renewalReminder && <RenewalReminder reminder={subscription.renewalReminder} onRenew={subscribe} isPending={start.isPending} error={notice} />}<div className="grid gap-5 md:grid-cols-[1.1fr_.9fr]"><div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--sidebar))] p-7 text-[hsl(var(--sidebar-foreground))] blueprint-grid md:p-9"><div className="absolute -right-16 -top-16 size-52 rounded-full bg-[hsl(var(--primary)/.16)] blur-3xl" /><div className="relative"><div className="flex items-center justify-between gap-4"><span className="rounded-full bg-[hsl(var(--primary)/.18)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">PLAN PROFESJONALISTA</span><span className={`text-right text-xs font-bold ${subscription.status === 'active' ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--sidebar-foreground)/.5)]'}`}>{statusCopy}</span></div><p className="mt-12 font-[var(--app-font-serif)] text-5xl font-bold">{subscription.monthlyPrice}</p><p className="mt-3 max-w-[320px] text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.62)]">Skontaktuj się z klientem, zanim zrobi to ktoś inny.</p><Button variant="primary" onClick={subscribe} disabled={start.isPending} className="mt-8 min-w-[230px] w-full sm:w-auto" style={{ color: '#17313d' }} aria-label={actionLabel} data-testid="button-start-subscription">{start.isPending ? 'Łączymy z PayU…' : actionLabel} <ArrowRight size={16} /></Button>{subscription.accessExpiresAt && subscription.status === 'active' && <p className="mt-4 text-xs font-semibold text-[hsl(var(--primary))]">Dostęp aktywny do {new Date(subscription.accessExpiresAt).toLocaleDateString('pl-PL')}.</p>}{notice && <p className="mt-4 max-w-md text-xs font-semibold leading-relaxed text-[hsl(var(--primary))]">{notice}</p>}</div></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7"><h2 className="font-[var(--app-font-serif)] text-2xl font-bold">W środku masz</h2><div className="mt-6 space-y-4">{['Nielimitowane przeglądanie zleceń', 'Odblokowanie kontaktu do wybranej pracy', 'Filtrowanie po branży i lokalizacji', 'Bez umów i długoterminowych zobowiązań'].map((item) => <div key={item} className="flex items-start gap-3 text-sm font-semibold"><span className="mt-0.5 grid size-5 place-items-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><Check size={13} /></span>{item}</div>)}</div><div className="mt-8 rounded-xl bg-[hsl(var(--muted))] p-4 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]"><ShieldCheck size={15} className="mb-2 text-[hsl(var(--secondary-foreground))]" />Bezpieczna płatność online przez PayU. Abonament włącza się automatycznie dopiero po serwerowym potwierdzeniu płatności.</div></div></div></div></AppShell>;
}

function ProtectedBilling() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation('/auth?redirect=%2Fbilling');
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn) {
    return <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))]"><LoadingState lines={1} /></div>;
  }

  return <Billing />;
}
 function LegacyProfilePage() {
  const profile = RoleProfile();
  const [saved, setSaved] = useState(false);
   return <AppShell profile={profile}><div className="mx-auto max-w-[850px]"><PageHeading eyebrow="Twoje konto" title="Profil i ustawienia" copy="Dopilnuj danych, które pomagają drugiej stronie poczuć się pewnie." /><div className="grid gap-5 md:grid-cols-[230px_1fr]"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><span className="mx-auto grid size-20 place-items-center rounded-3xl bg-[hsl(var(--accent))] text-2xl font-bold text-[hsl(var(--accent-foreground))]">{profile.firstName[0]}{profile.lastName[0]}</span><h2 className="mt-4 text-center font-[var(--app-font-serif)] text-xl font-bold">{profile.firstName} {profile.lastName}</h2><p className="mt-1 text-center text-xs text-[hsl(var(--muted-foreground))]">{profile.role === 'contractor' ? profile.companyName ?? 'Fachowiec' : 'Zleceniodawca'}</p><div className="mt-5 flex items-center justify-center gap-1.5 text-xs font-bold text-[hsl(var(--secondary-foreground))]"><BadgeCheck size={15} /> Konto zweryfikowane</div></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-7"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-5"><div><h2 className="font-[var(--app-font-serif)] text-2xl font-bold">Dane osobowe</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Widoczne w Twojej przestrzeni.</p></div><UserRound className="text-[hsl(var(--primary))]" size={21} /></div><form onSubmit={(e) => { e.preventDefault(); setSaved(true); }} className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Imię" defaultValue={profile.firstName} data-testid="input-profile-first-name" /><Field label="Nazwisko" defaultValue={profile.lastName} data-testid="input-profile-last-name" /><Field label="E-mail" type="email" defaultValue={profile.email} data-testid="input-profile-email" /><Field label="Telefon" defaultValue={profile.phone} data-testid="input-profile-phone" />{profile.role === 'contractor' && <div className="sm:col-span-2"><Field label="Nazwa firmy (opcjonalnie)" defaultValue={profile.companyName ?? ''} data-testid="input-profile-company" /></div>}<div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">{saved && <span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]" data-testid="status-profile-saved">Zmiany zapisane lokalnie</span>}<Button type="submit" data-testid="button-save-profile">Zapisz zmiany <Check size={15} /></Button></div></form></div></div>{profile.role === 'contractor' && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[hsl(var(--primary)/.28)] bg-[hsl(var(--primary)/.07)] p-5" data-testid="subscription-email-reminders"><Bell className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" size={18} /><div><h3 className="text-sm font-bold">Przypomnienie o końcu dostępu</h3><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Wyślemy bezpieczne przypomnienie na zweryfikowany adres e-mail kilka dni przed końcem abonamentu. Wiadomość zawiera tylko termin dostępu i link do odnowienia przez PayU.</p></div></div>}<div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex items-center gap-3"><Settings size={18} className="text-[hsl(var(--primary))]" /><div><h3 className="text-sm font-bold">Preferencje kontaktu</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Powiadomienia o nowych zleceniach pojawią się tutaj, gdy API będzie gotowe.</p></div><button className="ml-auto rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-preferences"><ChevronRight size={17} /></button></div></div></div></AppShell>;
}

function ProfilePage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const profileQuery = useGetMyProfile({
    query: {
      queryKey: getSessionProfileQueryKey(userId),
      enabled: isLoaded && Boolean(isSignedIn && userId),
      retry: false,
    },
  });
  const updateProfile = useUpdateMyProfile();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    companyAddress: '',
    serviceLocation: '',
    nip: '',
  });
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profileQuery.data) return;
    setForm({
      firstName: profileQuery.data.firstName,
      lastName: profileQuery.data.lastName,
      phone: profileQuery.data.phone,
      companyName: profileQuery.data.companyName ?? '',
      companyAddress: profileQuery.data.companyAddress ?? '',
      serviceLocation: profileQuery.data.serviceLocation ?? '',
      nip: profileQuery.data.nip ?? '',
    });
  }, [profileQuery.data]);

  if (!isLoaded || (isSignedIn && (!userId || profileQuery.isLoading))) {
    return <div className="min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-12 md:pl-[280px] md:pr-12"><div className="mx-auto max-w-[850px]"><PageHeading eyebrow="Twoje konto" title="Profil i ustawienia" copy="Pobieramy dane Twojego profilu." /><LoadingState lines={5} /></div></div>;
  }
  if (!isSignedIn) {
    return <StatusPage code="401" title="Zaloguj się, aby zobaczyć profil." copy="Dane profilu są dostępne wyłącznie dla aktualnej sesji." />;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return <div className="min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-12 md:pl-[280px] md:pr-12"><div className="mx-auto max-w-[850px]"><PageHeading eyebrow="Twoje konto" title="Profil i ustawienia" /><ErrorState message="Nie udało się pobrać profilu aktualnej sesji." /></div></div>;
  }

  const profile = profileQuery.data;
  const profileQueryKey = getSessionProfileQueryKey(userId);
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    if (
      profile.role === 'contractor' &&
      (!form.companyName.trim() ||
        !form.companyAddress.trim() ||
        !form.serviceLocation.trim() ||
        !/^\d{10}$/.test(form.nip.trim()))
    ) {
      setNotice('Podaj nazwę firmy, adres firmy, miejscowość obsługi i poprawny 10-cyfrowy NIP.');
      return;
    }
    updateProfile.mutate(
      {
        data: {
          role: profile.role === 'contractor' ? 'contractor' : 'customer',
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          companyName: profile.role === 'contractor' ? form.companyName.trim() : null,
          companyAddress: profile.role === 'contractor' ? form.companyAddress.trim() : null,
          serviceLocation: profile.role === 'contractor' ? form.serviceLocation.trim() : null,
          nip: profile.role === 'contractor' ? form.nip.trim() : null,
        },
      },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(profileQueryKey, updated);
          void queryClient.invalidateQueries({ queryKey: profileQueryKey });
          setNotice('Dane profilu zostały zapisane.');
        },
        onError: () => setNotice('Nie udało się zapisać zmian. Sprawdź wymagane pola.'),
      },
    );
  };

  const uploadImage = async (file?: File) => {
    if (!file || !user || profile.role !== 'contractor') return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setNotice('Wybierz obraz JPG, PNG lub WebP o rozmiarze do 5 MB.');
      return;
    }
    try {
      setUploading(true);
      setNotice('');
      await user.setProfileImage({ file });
      await user.reload();
      await queryClient.invalidateQueries({ queryKey: profileQueryKey });
      setNotice('Zdjęcie profilowe lub logo zostało zapisane.');
    } catch {
      setNotice('Nie udało się przesłać zdjęcia. Spróbuj ponownie.');
    } finally {
      setUploading(false);
    }
  };

  return <AppShell profile={profile}><div className="mx-auto max-w-[850px]">
    <PageHeading eyebrow="Twoje konto" title="Profil i ustawienia" copy="Edytuj dane widoczne w profilu. Numer NIP po rejestracji pozostaje niezmienny." />
    <div className="grid gap-5 md:grid-cols-[230px_1fr]">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        {profile.profileImageUrl
          ? <img src={profile.profileImageUrl} alt="Zdjęcie profilowe lub logo firmy" className="mx-auto size-24 rounded-3xl object-cover" />
          : <span className="mx-auto grid size-24 place-items-center rounded-3xl bg-[hsl(var(--accent))] text-2xl font-bold text-[hsl(var(--accent-foreground))]">{profile.firstName[0]}{profile.lastName[0]}</span>}
        <h2 className="mt-4 text-center font-[var(--app-font-serif)] text-xl font-bold">{profile.firstName} {profile.lastName}</h2>
        <p className="mt-1 text-center text-xs text-[hsl(var(--muted-foreground))]">{profile.role === 'contractor' ? profile.companyName ?? 'Fachowiec' : 'Zleceniodawca'}</p>
        {profile.role === 'contractor' && <label className="focus-ring mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2.5 text-xs font-bold hover:bg-[hsl(var(--muted))]">
          <Camera size={15} />{uploading ? 'Przesyłanie…' : 'Dodaj zdjęcie lub logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => void uploadImage(event.target.files?.[0])} data-testid="input-profile-image" />
        </label>}
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-7">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-5"><div><h2 className="font-[var(--app-font-serif)] text-2xl font-bold">Dane profilu</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Pola oznaczone jako niezmienne są chronione przez API.</p></div><UserRound className="text-[hsl(var(--primary))]" size={21} /></div>
        <form onSubmit={save} className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field required label="Imię" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} data-testid="input-profile-first-name" />
          <Field required label="Nazwisko" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} data-testid="input-profile-last-name" />
          <Field label="E-mail (konto Clerk)" type="email" value={profile.email} readOnly disabled data-testid="input-profile-email" />
          <Field required label="Telefon" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} data-testid="input-profile-phone" />
          {profile.role === 'contractor' && <>
            <div className="sm:col-span-2"><Field required label="Nazwa firmy" value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} data-testid="input-profile-company" /></div>
            <div className="sm:col-span-2"><Field required label="Adres firmy" value={form.companyAddress} onChange={(event) => setForm((current) => ({ ...current, companyAddress: event.target.value }))} data-testid="input-profile-company-address" /></div>
            <div className="sm:col-span-2"><Field required label="Miejscowość obsługi" value={form.serviceLocation} onChange={(event) => setForm((current) => ({ ...current, serviceLocation: event.target.value }))} placeholder="np. Kraków" data-testid="input-profile-service-location" /></div>
            <div className="sm:col-span-2">
              <Field
                required={!profile.nip}
                label={profile.nip ? 'NIP (nie można zmienić)' : 'NIP (uzupełnij, aby zapisać)'}
                value={form.nip}
                readOnly={Boolean(profile.nip)}
                disabled={Boolean(profile.nip)}
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => setForm((current) => ({ ...current, nip: event.target.value.replace(/\D/g, '') }))}
                data-testid="input-profile-nip"
              />
            </div>
          </>}
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
            {notice && <span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]" role="status">{notice}</span>}
            <Button type="submit" disabled={updateProfile.isPending} data-testid="button-save-profile">{updateProfile.isPending ? 'Zapisywanie…' : <>Zapisz zmiany <Check size={15} /></>}</Button>
          </div>
        </form>
      </div>
    </div>
  </div></AppShell>;
}

function SubscriptionHistory({ profileId }: { profileId: string }) {
  const { data: history, isLoading, isError } = useListAdminSubscriptionHistory(
    profileId,
    {
      query: {
        queryKey: getListAdminSubscriptionHistoryQueryKey(profileId),
        retry: false,
      },
    },
  );

  const statusLabels: Record<string, string> = {
    active: 'Aktywny',
    inactive: 'Nieaktywny',
    past_due: 'Zaległy',
    canceled: 'Anulowany',
  };

  const statusClassNames: Record<string, string> = {
    active: 'bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))]',
    inactive: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    past_due: 'bg-[hsl(var(--destructive)/.15)] text-[hsl(var(--destructive))]',
    canceled: 'bg-[hsl(var(--destructive)/.15)] text-[hsl(var(--destructive))]',
  };

  const statusName = (status: AdminSubscriptionStatusHistory['newStatus'] | null) =>
    status ? statusLabels[status] ?? status : 'Brak wcześniejszego statusu';

  return <div className="w-full basis-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] p-4" data-testid={`admin-history-${profileId}`}>
    <div className="mb-3 flex items-center gap-2">
      <History size={16} className="text-[hsl(var(--primary))]" />
      <h3 className="text-sm font-bold">Historia decyzji o dostępie</h3>
    </div>
    {isLoading ? (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Ładowanie historii…</p>
    ) : isError ? (
      <p className="text-sm font-semibold text-[hsl(var(--destructive))]">Nie udało się pobrać historii.</p>
    ) : history?.length === 0 ? (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Brak zapisanych zmian tego abonamentu.</p>
    ) : (
      <div className="space-y-2">
        {history?.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid={`admin-history-entry-${entry.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${entry.previousStatus ? statusClassNames[entry.previousStatus] : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{statusName(entry.previousStatus)}</span>
              <ArrowRight size={14} className="text-[hsl(var(--muted-foreground))]" />
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClassNames[entry.newStatus]}`}>{statusName(entry.newStatus)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-semibold text-[hsl(var(--foreground))]">Administrator: {entry.changedByAdminName}</span>
              <span>{new Date(entry.createdAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>;
}

function StatusPage({ code, title, copy }: { code: string; title: string; copy: string }) {
  return <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))] px-5 text-center"><div><div className="mx-auto mb-7 grid size-16 place-items-center rounded-2xl bg-[hsl(var(--primary)/.16)] text-[hsl(var(--primary))]"><Wrench size={27} /></div><p className="font-mono text-sm font-bold text-[hsl(var(--primary))]">{code}</p><h1 className="mt-3 font-[var(--app-font-serif)] text-4xl font-bold">{title}</h1><p className="mx-auto mt-3 max-w-[380px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{copy}</p><Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--sidebar))] px-5 py-3 text-sm font-bold text-[hsl(var(--sidebar-foreground))]" data-testid="link-status-home"><ArrowRight size={16} className="rotate-180" /> Wróć na początek</Link></div></div>;
}

function PrivacyPolicy() {
  const sections = [
    {
      title: '1. Administrator Danych Osobowych',
      body: <p>Administratorem danych osobowych jest <strong>MM Renowacje Monika Marcinkowska</strong>, ul. Kawiary 25/19, 62-200 Gniezno, NIP: 7842236876. Kontakt w sprawach dotyczących prywatności i RODO: <a className="font-semibold text-[hsl(var(--primary))] underline underline-offset-2" href="mailto:aplikacjegniezno@int.pl">aplikacjegniezno@int.pl</a>.</p>,
    },
    {
      title: '2. Zakres zbieranych danych',
      body: <><p>Aplikacja rozróżnia Zleceniodawców i Wykonawców. W zależności od sposobu korzystania możemy przetwarzać:</p><ul className="mt-3 list-disc space-y-2 pl-5"><li><strong>Dane rejestracyjne:</strong> imię, nazwisko lub firma, email, numer telefonu oraz hasło w postaci zaszyfrowanej;</li><li><strong>Dane profilu Wykonawcy:</strong> NIP, zakres usług, miasto działania, opis, portfolio i cennik;</li><li><strong>Dane zleceń:</strong> treść ogłoszenia, adres wykonania usługi, budżet, termin, zdjęcia i filmy dodane przez użytkownika;</li><li><strong>Dane komunikacyjne:</strong> historia czatu, oceny i opinie;</li><li><strong>Dane techniczne:</strong> adres IP, ID urządzenia, model telefonu, wersja systemu oraz dane diagnostyczne Firebase Crashlytics;</li><li><strong>Lokalizacja GPS:</strong> wyłącznie po wyrażeniu zgody użytkownika.</li></ul></>,
    },
    {
      title: '3. Cele i podstawy prawne przetwarzania RODO',
      body: <ol className="list-decimal space-y-3 pl-5"><li><strong>Realizacja umowy (art. 6 ust. 1 lit. b RODO)</strong> — prowadzenie konta, publikacja i obsługa zleceń.</li><li><strong>Zgoda (art. 6 ust. 1 lit. a RODO)</strong> — dostęp do lokalizacji, galerii, powiadomień PUSH i newslettera.</li><li><strong>Uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO)</strong> — bezpieczeństwo, przeciwdziałanie oszustwom, statystyka i rozwój aplikacji.</li><li><strong>Obowiązek prawny (art. 6 ust. 1 lit. c RODO)</strong> — rozliczenia księgowe.</li></ol>,
    },
    {
      title: '4. Odbiorcy danych',
      body: <p>Dane Zleceniodawcy są widoczne dla Wykonawcy dopiero po zaakceptowaniu oferty i odwrotnie. Nie sprzedajemy danych osobowych. Zaufani podwykonawcy, którzy mogą przetwarzać dane w zakresie niezbędnym do działania aplikacji, to: Google LLC (Firebase, Google Maps, Google Play), Apple Inc., dostawca hostingu oraz dostawca poczty elektronicznej.</p>,
    },
    {
      title: '5. Okres przechowywania',
      body: <p>Dane konta przechowujemy do czasu usunięcia konta. Dane zleceń i korespondencji przechowujemy przez 3 lata od zamknięcia zlecenia. Dane księgowe przechowujemy przez 5 lat, zgodnie z obowiązującymi przepisami.</p>,
    },
    {
      title: '6. Prawa użytkownika',
      body: <p>Użytkownik ma prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia, wniesienia sprzeciwu oraz wniesienia skargi do Prezesa UODO. Wnioski można kierować na adres <a className="font-semibold text-[hsl(var(--primary))] underline underline-offset-2" href="mailto:aplikacjegniezno@int.pl">aplikacjegniezno@int.pl</a>. Odpowiedź zostanie udzielona w terminie 30 dni.</p>,
    },
    {
      title: '7. Usuwanie konta',
      body: <p>Konto można usunąć w aplikacji, wybierając: <strong>Profil → Ustawienia → Usuń konto</strong>. Dane zostaną usunięte w ciągu 30 dni, z wyjątkiem danych, które musimy zachować na podstawie obowiązujących przepisów prawa.</p>,
    },
    {
      title: '8. Cookies i SDK',
      body: <p>Aplikacja używa Firebase Analytics i Crashlytics. Użytkownik może wyłączyć udostępnianie danych analitycznych w ustawieniach telefonu.</p>,
    },
    {
      title: '9. Aktualizacja polityki',
      body: <p>Polityka prywatności może być aktualizowana w przypadku zmian w aplikacji, wykorzystywanych usługach lub przepisach prawa. Aktualna wersja jest dostępna pod adresem <strong>zlecmajstra.pl/politykaprywatnosci</strong>.</p>,
    },
  ];

  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <PublicHeader />
    <main className="mx-auto max-w-[900px] px-5 pb-20 pt-32 md:px-10 md:pt-40">
      <div className="mb-12 border-b border-[hsl(var(--border))] pb-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Zleć Majstra</p>
        <h1 className="max-w-[820px] font-[var(--app-font-serif)] text-4xl font-bold tracking-tight md:text-6xl">Polityka prywatności aplikacji mobilnej „Zleć Majstra”</h1>
        <p className="mt-5 max-w-[700px] text-base leading-relaxed text-[hsl(var(--muted-foreground))]">Informacje o przetwarzaniu danych osobowych użytkowników aplikacji mobilnej „Zleć Majstra”.</p>
        <p className="mt-5 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Data aktualizacji: 31.08.2026</p>
      </div>
      <div className="space-y-10 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
        {sections.map((section) => <section key={section.title}><h2 className="mb-3 font-[var(--app-font-serif)] text-2xl font-bold leading-tight text-[hsl(var(--foreground))]">{section.title}</h2>{section.body}</section>)}
      </div>
      <Link href="/" className="mt-12 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--sidebar))] px-5 py-3 text-sm font-bold text-[hsl(var(--sidebar-foreground))]" data-testid="link-privacy-home"><ArrowRight size={16} className="rotate-180" /> Wróć na stronę główną</Link>
    </main>
  </div>;
}

function TermsOfService() {
  const sections = [
    {
      title: '§ 1 Postanowienia ogólne i Usługodawca',
      body: <ol className="list-decimal space-y-3 pl-5"><li>Niniejszy Regulamin określa zasady korzystania z aplikacji mobilnej oraz serwisu internetowego pod nazwą „Zleć Majstra”, zwanych dalej „Aplikacją”.</li><li>Usługodawcą i właścicielem Aplikacji jest <strong>MM Renowacje Monika Marcinkowska</strong>, ul. Kawiary 25/19, 62-200 Gniezno, NIP: 7842236876, e-mail: <a className="font-semibold text-[hsl(var(--primary))] underline underline-offset-2" href="mailto:aplikacjegniezno@int.pl">aplikacjegniezno@int.pl</a>, zwana dalej „Usługodawcą”.</li><li>Każda osoba instalująca Aplikację lub zakładająca konto akceptuje niniejszy Regulamin.</li></ol>,
    },
    {
      title: '§ 2 Definicje',
      body: <ol className="list-decimal space-y-3 pl-5"><li><strong>Aplikacja</strong> – oprogramowanie „Zleć Majstra” wraz z całym kodem źródłowym, kodem obiektowym, interfejsem użytkownika (UI/UX), grafiką, logo, bazą danych, algorytmami, modelem biznesowym, dokumentacją i elementami audiowizualnymi.</li><li><strong>Użytkownik</strong> – każda osoba fizyczna, prawna lub jednostka korzystająca z Aplikacji.</li><li><strong>Treści</strong> – wszelkie treści zamieszczone w Aplikacji.</li></ol>,
    },
    {
      title: '§ 3 Zasady korzystania i Licencja',
      body: <ol className="list-decimal space-y-3 pl-5"><li>Usługodawca udziela Użytkownikowi niewyłącznej, nieprzenoszalnej, terytorialnie nieograniczonej licencji na korzystanie z Aplikacji wyłącznie w celu jej osobistego użytku zgodnie z przeznaczeniem.</li><li>Licencja nie obejmuje prawa do udzielania sublicencji, odsprzedaży, wynajmu ani udostępniania Aplikacji osobom trzecim.</li><li>Użytkownik nie nabywa żadnych praw własności intelektualnej do Aplikacji. Wszelkie prawa pozostają przy Usługodawcy.</li></ol>,
    },
    {
      title: '§ 4 Własność Intelektualna',
      body: <><ol className="list-decimal space-y-3 pl-5"><li>Aplikacja „Zleć Majstra” jako całość oraz jej pojedyncze elementy stanowią utwór w rozumieniu ustawy z dnia 4 lutego 1994 r. o prawie autorskim i prawach pokrewnych oraz przedmiot praw własności intelektualnej Usługodawcy.</li><li>Ochronie podlegają w szczególności:</li></ol><ul className="mt-3 list-[lower-alpha] space-y-2 pl-10"><li>kod źródłowy i obiektowy Aplikacji,</li><li>szata graficzna, layout, układ funkcjonalny, interfejs użytkownika UI/UX, ikony, logo „Zleć Majstra”,</li><li>baza danych zleceń, wykonawców i zleceniodawców jako baza danych w rozumieniu ustawy o ochronie baz danych,</li><li>algorytmy dopasowywania, logika działania, model biznesowy oraz know-how i tajemnica przedsiębiorstwa Usługodawcy.</li></ul><ol start={3} className="mt-3 list-decimal space-y-3 pl-5"><li>Nazwa „Zleć Majstra”, logo oraz szata graficzna stanowią znak towarowy i podlegają ochronie prawnej. Trwa procedura zgłoszenia znaku w EUIPO / UPRP.</li><li>Wszelkie kopiowanie, powielanie, modyfikowanie całości lub części Aplikacji bez pisemnej zgody Usługodawcy jest zabronione.</li></ol></>,
    },
    {
      title: '§ 5 Bezwzględny zakaz kopiowania i klonowania',
      body: <><p>W celu ochrony praw Usługodawcy, Użytkownikowi oraz jakiejkolwiek osobie trzeciej, która uzyskała dostęp do Aplikacji, <strong>ZABRANIA SIĘ</strong> pod rygorem odpowiedzialności odszkodowawczej i karnej:</p><ol className="mt-3 list-decimal space-y-3 pl-5"><li>Zakazu reverse engineering: dekompilacji, dezasemblacji, deobfuskacji, analizy kodu, obchodzenia zabezpieczeń technicznych.</li><li>Scrapingu i kopiowania: automatycznego lub manualnego pobierania, kopiowania, reprodukowania treści, bazy danych, list wykonawców, opisów, zdjęć za pomocą botów, scraperów, crawlerów.</li><li>Tworzenia dzieł zależnych i klonów: tworzenia na bazie Aplikacji, jej wyglądu, funkcjonalności lub jej części jakichkolwiek innych aplikacji, serwisów, oprogramowania o podobnym przeznaczeniu, w szczególności o charakterze konkurencyjnym. Za naruszenie uznaje się również stworzenie produktu o istotnie podobnym układzie funkcjonalnym, przepływie użytkownika (user flow) lub logice biznesowej, który powstał w wyniku inspiracji Aplikacją.</li><li>Wykorzystywania know-how: wykorzystywania informacji o sposobie działania, funkcjach i pomysłach zawartych w Aplikacji do budowy własnego produktu konkurencyjnego.</li></ol><p className="mt-3">Naruszenie § 5 ust. 3 i 4 będzie traktowane jako naruszenie tajemnicy przedsiębiorstwa w rozumieniu ustawy o zwalczaniu nieuczciwej konkurencji (Dz.U. 2022 poz. 1233) oraz jako czyn nieuczciwej konkurencji z art. 3 i art. 11 tej ustawy.</p></>,
    },
    {
      title: '§ 6 Konsekwencje naruszenia',
      body: <><ol className="list-decimal space-y-3 pl-5"><li>W przypadku stwierdzenia naruszenia § 4 i § 5, Usługodawca uprawniony jest do:</li></ol><ul className="mt-3 list-[lower-alpha] space-y-2 pl-10"><li>natychmiastowego zablokowania konta Użytkownika,</li><li>zgłoszenia naruszenia do Google LLC, Apple Inc. w celu usunięcia aplikacji-klona ze sklepów Google Play i App Store w trybie DMCA,</li><li>zgłoszenia naruszenia do Google Search w celu usunięcia strony-klona z wyników wyszukiwania,</li><li>wystąpienia na drogę sądową z roszczeniem o zaniechanie naruszeń, usunięcie skutków naruszenia, wydanie bezpodstawnie uzyskanych korzyści oraz zapłatę odszkodowania na zasadach ogólnych lub poprzez zapłatę trzykrotności stosownego wynagrodzenia (art. 79 Prawa Autorskiego).</li></ul><ol start={2} className="mt-3 list-decimal space-y-3 pl-5"><li>Usługodawca zastrzega sobie prawo do dochodzenia odszkodowania w wysokości rzeczywiście poniesionej szkody, w tym utraconych korzyści, w pełnej wysokości.</li><li>Użytkownik ponosi pełną odpowiedzialność za działania osób trzecich, którym udostępnił dostęp do swojego konta.</li></ol></>,
    },
    {
      title: '§ 7 Oświadczenie o autorstwie i dowody',
      body: <ol className="list-decimal space-y-3 pl-5"><li>Usługodawca posiada pełną dokumentację powstania Aplikacji: repozytoria kodu z historią commitów, projekty graficzne, umowy przenoszące autorskie prawa majątkowe od wykonawców, depozyty notarialne kodu źródłowego.</li><li>W kodzie Aplikacji umieszczono cyfrowe znaki wodne oraz identyfikatory umożliwiające jednoznaczne udowodnienie autorstwa w postępowaniu sądowym.</li></ol>,
    },
    {
      title: '§ 8 Postanowienia końcowe',
      body: <ol className="list-decimal space-y-3 pl-5"><li>Regulamin dostępny jest nieodpłatnie w Aplikacji.</li><li>W sprawach nieuregulowanych stosuje się prawo polskie.</li><li>Sądem właściwym do rozstrzygania sporów jest sąd właściwy dla siedziby Usługodawcy, tj. sąd w Gnieźnie / Poznaniu.</li><li>Kontakt w sprawach naruszeń: <a className="font-semibold text-[hsl(var(--primary))] underline underline-offset-2" href="mailto:aplikacjegniezno@int.pl">aplikacjegniezno@int.pl</a>.</li></ol>,
    },
  ];

  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <PublicHeader />
    <main className="mx-auto max-w-[900px] px-5 pb-20 pt-32 md:px-10 md:pt-40">
      <div className="mb-12 border-b border-[hsl(var(--border))] pb-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Zleć Majstra</p>
        <h1 className="font-[var(--app-font-serif)] text-4xl font-bold tracking-tight md:text-6xl">Regulamin aplikacji „Zleć Majstra”</h1>
        <p className="mt-5 max-w-[700px] text-base leading-relaxed text-[hsl(var(--muted-foreground))]">Regulamin aplikacji mobilnej i serwisu „Zleć Majstra”.</p>
        <p className="mt-5 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Obowiązuje od: 01.09.2026</p>
      </div>
      <div className="space-y-10 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
        {sections.map((section) => <section key={section.title}><h2 className="mb-3 font-[var(--app-font-serif)] text-2xl font-bold leading-tight text-[hsl(var(--foreground))]">{section.title}</h2>{section.body}</section>)}
      </div>
       <p className="mt-10 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Akceptując Regulamin w Aplikacji, Użytkownik oświadcza, że zapoznał się z zakazem klonowania i kopiowania określonym w § 5 i zobowiązuje się go przestrzegać.</p>
       <Link href="/" className="mt-12 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--sidebar))] px-5 py-3 text-sm font-bold text-[hsl(var(--sidebar-foreground))]" data-testid="link-terms-home"><ArrowRight size={16} className="rotate-180" /> Wróć na stronę główną</Link>
    </main>
  </div>;
}

function PremiumTerms() {
  const sections = [
    {
      title: '§1 Przedmiot regulaminu',
      body: <p>Regulamin określa zasady zakupu i korzystania z Pakietu Premium dla fachowców w aplikacji <strong>Zleć Majstra</strong>. Usługodawcą i sprzedawcą Pakietu jest MM Renowacje Monika Marcinkowska.</p>,
    },
    {
      title: '§2 Zakres Pakietu Premium',
      body: <p>Pakiet Premium zapewnia fachowcowi dostęp do płatnych funkcji platformy, w tym możliwość rozpoczynania rozmów dotyczących zleceń i korzystania z funkcji kontaktowych zgodnie z zasadami ochrony danych obowiązującymi w aplikacji.</p>,
    },
    {
      title: '§3 Cena i płatności PayU',
      body: <ol className="list-decimal space-y-3 pl-5"><li>Cena Pakietu wynosi <strong>99,00 zł brutto miesięcznie</strong>. Zobowiązanie trwa 12 miesięcy, a łączny koszt roczny wynosi <strong>1 188,00 zł brutto</strong>.</li><li>Operatorem płatności jest PayU S.A. z siedzibą w Poznaniu, ul. Grunwaldzka 186, 60-166 Poznań, KRS 0000274399.</li><li>Pierwsza opłata 99,00 zł jest pobierana w dniu zakupu Pakietu za pośrednictwem bramki PayU.</li><li>Kolejne 11 opłat po 99,00 zł jest pobieranych co miesiąc, w rocznicę zakupu, z zapisanej karty lub metody płatności obsługującej obciążenia cykliczne PayU.</li><li>Użytkownik wyraża zgodę na przechowywanie przez PayU tokenu karty lub metody płatności w celu realizacji obciążeń cyklicznych.</li><li>Informacja o nadchodzącej płatności jest wysyłana na adres e-mail 3 dni przed terminem obciążenia.</li><li>W przypadku niepowodzenia płatności próba może zostać ponowiona po 48 i 72 godzinach. Po trzech nieudanych próbach dostęp Premium zostaje zawieszony do czasu uregulowania należności.</li></ol>,
    },
    {
      title: '§4 Czas trwania i zarządzanie subskrypcją',
      body: <><p>Pakiet jest zawierany na 12 miesięcy. Po tym okresie przechodzi na czas nieokreślony w cenie 99,00 zł brutto miesięcznie, z możliwością anulowania przyszłego odnowienia.</p><p className="mt-3">Subskrypcją można zarządzać w aplikacji w sekcji <strong>Profil → Subskrypcja</strong> lub kontaktując się pod adresem <a className="font-semibold text-[hsl(var(--primary))] underline underline-offset-2" href="mailto:aplikacjegniezno@int.pl">aplikacjegniezno@int.pl</a>.</p></>,
    },
    {
      title: '§5 Odstąpienie i rozpoczęcie usługi',
      body: <p>Przed zakupem użytkownik może wyrazić zgodę na rozpoczęcie świadczenia Pakietu Premium przed upływem 14 dni oraz potwierdzić, że po pełnym wykonaniu usługi lub skorzystaniu z funkcji Premium może utracić prawo odstąpienia w zakresie przewidzianym przez obowiązujące prawo. Uprawnienia konsumenta wynikające z bezwzględnie obowiązujących przepisów pozostają nienaruszone.</p>,
    },
    {
      title: '§6 Faktury i kontakt',
      body: <p>Faktury VAT są wystawiane przez MM Renowacje Monika Marcinkowska po udanej płatności i przesyłane na adres e-mail przypisany do konta. Pytania dotyczące płatności i Pakietu można kierować na adres <a className="font-semibold text-[hsl(var(--primary))] underline underline-offset-2" href="mailto:aplikacjegniezno@int.pl">aplikacjegniezno@int.pl</a>.</p>,
    },
  ];

  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <PublicHeader />
    <main className="mx-auto max-w-[900px] px-5 pb-20 pt-32 md:px-10 md:pt-40">
      <div className="mb-12 border-b border-[hsl(var(--border))] pb-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Zleć Majstra · PayU</p>
        <h1 className="max-w-[820px] font-[var(--app-font-serif)] text-4xl font-bold tracking-tight md:text-6xl">Regulamin zakupu Pakietu Premium dla fachowców</h1>
        <p className="mt-5 max-w-[700px] text-base leading-relaxed text-[hsl(var(--muted-foreground))]">Zasady ceny, płatności cyklicznych, czasu trwania i korzystania z Pakietu Premium w aplikacji Zleć Majstra.</p>
        <p className="mt-5 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Data aktualizacji: 31.08.2026</p>
      </div>
      <div className="space-y-10 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
        {sections.map((section) => <section key={section.title}><h2 className="mb-3 font-[var(--app-font-serif)] text-2xl font-bold leading-tight text-[hsl(var(--foreground))]">{section.title}</h2>{section.body}</section>)}
      </div>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--sidebar))] px-5 py-3 text-sm font-bold text-[hsl(var(--sidebar-foreground))]" data-testid="link-premium-terms-home"><ArrowRight size={16} className="rotate-180" /> Wróć na stronę główną</Link>
        <Link href="/billing" className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3 text-sm font-bold" data-testid="link-premium-terms-billing">Przejdź do płatności <ArrowRight size={16} /></Link>
      </div>
    </main>
  </div>;
}

function AdminSubscriptionsPage() {
  const { profile, isLoading: isProfileLoading, isError: isProfileError } = useSessionProfile();
  const [notice, setNotice] = useState('');
  const [historyProfileId, setHistoryProfileId] = useState<string | null>(null);

  const { data: subscriptions, isLoading, isError } = useListAdminSubscriptions(
    { status: 'all' },
    { query: { queryKey: getListAdminSubscriptionsQueryKey({ status: 'all' }), retry: false, enabled: profile.role === 'admin' } }
  );

  const updateSub = useUpdateAdminSubscription();

  const handleUpdate = (profileId: string, status: 'active' | 'inactive' | 'canceled') => {
    setNotice('');
    updateSub.mutate({ profileId, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminSubscriptionsQueryKey({ status: 'all' }) });
        queryClient.invalidateQueries({ queryKey: getListAdminSubscriptionHistoryQueryKey(profileId) });
        queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
        setNotice(status === 'active' ? 'Wpłata została zaksięgowana, a abonament aktywowany.' : status === 'inactive' ? 'Dostęp fachowca został wyłączony.' : 'Dostęp fachowca został anulowany.');
      },
      onError: () => setNotice('Nie udało się zapisać zmiany. Spróbuj ponownie.')
    });
  };

  const statusLabels: Record<string, { label: string; className: string }> = {
    active: { label: 'Aktywny', className: 'bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/.3)]' },
    inactive: { label: 'Nieaktywny', className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]' },
    past_due: { label: 'Zaległy', className: 'bg-[hsl(var(--destructive)/.15)] text-[hsl(var(--destructive))] border-[hsl(var(--destructive)/.3)]' },
    canceled: { label: 'Anulowany', className: 'bg-[hsl(var(--destructive)/.15)] text-[hsl(var(--destructive))] border-[hsl(var(--destructive)/.3)]' }
  };

  if (isProfileLoading) return <AppShell profile={profile}><LoadingState lines={4} /></AppShell>;
  if (isProfileError) return <StatusPage code="401" title="Nie udało się wczytać konta." copy="Odśwież stronę lub zaloguj się ponownie." />;
  if (profile.role !== 'admin') {
    return <StatusPage code="403" title="Brak dostępu." copy="Ta część aplikacji jest dostępna wyłącznie dla administratora." />;
  }

  return <AppShell profile={profile}>
    <div className="mx-auto max-w-[1050px]">
      <PageHeading eyebrow="Panel Administratora" title="Abonamenty fachowców" copy="Monitoruj płatności PayU i koryguj dostęp wyłącznie w sytuacjach wyjątkowych." />
      {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${updateSub.isError ? 'border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)] text-[hsl(var(--destructive))]' : 'border-[hsl(var(--secondary-foreground)/.2)] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]'}`} role="status" data-testid="status-admin-subscription-update">{notice}</div>}
      {isLoading ? <LoadingState lines={5} /> : isError ? <ErrorState /> : (
        <div className="space-y-4">
          {subscriptions?.length === 0 ? (
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-10 text-center text-[hsl(var(--muted-foreground))]" data-testid="admin-subs-empty">
              Brak subskrypcji do wyświetlenia.
            </div>
          ) : (
            subscriptions?.map((sub) => (
              <div key={sub.id} className={`flex flex-col gap-5 rounded-2xl border bg-[hsl(var(--card))] p-5 shadow-sm transition-all md:flex-row md:flex-wrap md:items-center md:justify-between ${sub.activationRequested && sub.status !== 'active' ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary)/.5)]' : 'border-[hsl(var(--border))]'}`} data-testid={`admin-sub-${sub.id}`}>
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-[var(--app-font-serif)] text-lg font-bold text-[hsl(var(--foreground))]">{sub.contractorName}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusLabels[sub.status]?.className || statusLabels.inactive.className}`}>
                      {statusLabels[sub.status]?.label || sub.status}
                    </span>
                    {sub.activationRequested && sub.status !== 'active' && (
                      <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--secondary))] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--secondary-foreground))]">
                        <Bell size={12} /> Oczekuje na akceptację
                      </span>
                    )}
                    {sub.paymentProvider && <span className="rounded-full border border-[hsl(var(--border))] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{sub.paymentProvider === 'payu' ? `PayU: ${sub.paymentStatus ?? 'brak statusu'}` : 'Korekta ręczna'}</span>}
                  </div>
                  <div className="grid gap-x-6 gap-y-1 text-sm text-[hsl(var(--muted-foreground))] sm:grid-cols-2">
                    <span className="flex items-center gap-1.5" data-testid={`admin-sub-${sub.id}-company`}><Building2 size={14} /> {sub.companyName || 'Brak nazwy firmy'}</span>
                    <span className="flex items-center gap-1.5"><Mail size={14} /> {sub.email}</span>
                    <span className="flex items-center gap-1.5"><Phone size={14} /> {sub.phone}</span>
                    <span className="flex items-center gap-1.5"><Tag size={14} /> {sub.planName} ({sub.monthlyPrice})</span>
                  </div>
                  <div className="mt-3 text-xs text-[hsl(var(--muted-foreground)/.7)]">
                    Ostatnia aktualizacja: {new Date(sub.updatedAt).toLocaleDateString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    {sub.accessExpiresAt && <> · dostęp do {new Date(sub.accessExpiresAt).toLocaleDateString('pl-PL')}</>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-4 md:border-t-0 md:pt-0 md:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setHistoryProfileId((current) => current === sub.profileId ? null : sub.profileId)}
                    aria-expanded={historyProfileId === sub.profileId}
                    data-testid={`button-history-${sub.profileId}`}
                  >
                    <History size={16} /> {historyProfileId === sub.profileId ? 'Ukryj historię' : 'Historia zmian'}
                  </Button>
                  {sub.status !== 'active' && (
                    <Button
                      variant="primary"
                      onClick={() => handleUpdate(sub.profileId, 'active')}
                      disabled={updateSub.isPending}
                      data-testid={`button-activate-${sub.profileId}`}
                    >
                      <Check size={16} /> Awaryjnie aktywuj
                    </Button>
                  )}
                  {sub.status === 'active' && (
                    <Button
                      variant="outline"
                      onClick={() => handleUpdate(sub.profileId, 'inactive')}
                      disabled={updateSub.isPending}
                      data-testid={`button-suspend-${sub.profileId}`}
                    >
                      <LockKeyhole size={16} /> Zawieś dostęp
                    </Button>
                  )}
                  {sub.status !== 'canceled' && (
                    <Button
                      variant="ghost"
                      className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]"
                      onClick={() => handleUpdate(sub.profileId, 'canceled')}
                      disabled={updateSub.isPending}
                      data-testid={`button-cancel-${sub.profileId}`}
                    >
                      Anuluj
                    </Button>
                  )}
                </div>
                {historyProfileId === sub.profileId && (
                  <SubscriptionHistory profileId={sub.profileId} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  </AppShell>;
}


function AdminOverviewPage() {
  const { profile, isLoading: isProfileLoading, isError: isProfileError } = useSessionProfile();
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey(), enabled: profile.role === 'admin' } });

  if (isProfileLoading) return <AppShell profile={profile}><LoadingState lines={4} /></AppShell>;
  if (isProfileError) return <StatusPage code="401" title="Nie udało się wczytać konta." copy="Odśwież stronę lub zaloguj się ponownie." />;
  if (profile.role !== 'admin') return <StatusPage code="403" title="Brak dostępu." copy="Ta część aplikacji jest dostępna wyłącznie dla administratora." />;

  return (
    <AppShell profile={profile}>
      <PageHeading eyebrow="Panel administratora" title="Podsumowanie" copy="Statystyki i kluczowe wskaźniki platformy." />
      {overview.isLoading ? <LoadingState /> : overview.isError ? <ErrorState /> : overview.data && (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Użytkownicy" value={overview.data.totalUsers} sub={`Nowi (7 dni): +${overview.data.newUsersThisWeek}`} />
            <StatCard title="Klienci / Fachowcy" value={`${overview.data.customers} / ${overview.data.contractors}`} sub={`Zablokowani: ${overview.data.blockedUsers}`} />
            <StatCard title="Zlecenia" value={overview.data.totalRequests} sub={`Otwarte: ${overview.data.openRequests}`} />
            <StatCard title="Nowe zlecenia (7 dni)" value={overview.data.newRequestsThisWeek} sub={`Zablokowane: ${overview.data.blockedRequests}`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard title="Aktywne subskrypcje" value={overview.data.activeSubscriptions} />
            <StatCard title="Przychód z płatności" value={`${(overview.data.completedRevenueGrosz / 100).toFixed(2)} zł`} sub={`Zakończone transakcje: ${overview.data.completedPayments}`} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ title, value, sub }: { title: string, value: React.ReactNode, sub?: string }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{title}</p>
      <p className="mt-2 font-[var(--app-font-serif)] text-3xl font-bold text-[hsl(var(--foreground))]">{value}</p>
      {sub && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>}
    </div>
  );
}

function AdminSettingsPage() {
  const { profile, isLoading: isProfileLoading, isError: isProfileError } = useSessionProfile();
  const settings = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey(), enabled: profile.role === 'admin', retry: false } });
  const updateSettings = useUpdateAdminSettings();

  if (isProfileLoading) return <AppShell profile={profile}><LoadingState lines={4} /></AppShell>;
  if (isProfileError) return <StatusPage code="401" title="Nie udało się wczytać konta." copy="Odśwież stronę lub zaloguj się ponownie." />;
  if (profile.role !== 'admin') return <StatusPage code="403" title="Brak dostępu." copy="Ta część aplikacji jest dostępna wyłącznie dla administratora." />;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateSettings.mutate({
      data: {
        announcement: fd.get('announcement') as string,
        supportEmail: fd.get('supportEmail') as string,
        chatbotEnabled: fd.get('chatbotEnabled') === 'on',
        chatbotName: fd.get('chatbotName') as string,
        chatbotWelcomeMessage: fd.get('chatbotWelcomeMessage') as string,
        chatbotFallbackMessage: fd.get('chatbotFallbackMessage') as string,
        chatbotKnowledgeBase: fd.get('chatbotKnowledgeBase') as string,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSiteSettingsQueryKey() });
      }
    });
  };

  return (
    <AppShell profile={profile}>
      <PageHeading eyebrow="Panel administratora" title="Ustawienia platformy" copy="Konfiguracja ogłoszeń, wsparcia i wirtualnego asystenta." />
      {settings.isLoading ? <LoadingState /> : settings.isError ? <ErrorState /> : settings.data && (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-8 pb-20">
          <section className="space-y-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
            <h3 className="text-lg font-bold">Główne ustawienia</h3>
            <Field label="Ogłoszenie publiczne (widoczne dla wszystkich)" name="announcement" defaultValue={settings.data.announcement} placeholder="Np. Przerwa techniczna 15.08 w godzinach 22:00-02:00" data-testid="input-announcement" />
            <Field label="E-mail wsparcia" name="supportEmail" defaultValue={settings.data.supportEmail} data-testid="input-support-email" />
          </section>

          <section className="space-y-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Wirtualny Asystent (Chatbot)</h3>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="chatbotEnabled" defaultChecked={settings.data.chatbotEnabled} className="size-4 accent-[hsl(var(--primary))]" data-testid="input-chatbot-enabled" />
                Włącz chatbota
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nazwa chatbota" name="chatbotName" defaultValue={settings.data.chatbotName} data-testid="input-chatbot-name" />
              <Field label="Wiadomość powitalna" name="chatbotWelcomeMessage" defaultValue={settings.data.chatbotWelcomeMessage} data-testid="input-chatbot-welcome" />
            </div>
            <Field label="Wiadomość awaryjna (gdy nie zna odpowiedzi)" name="chatbotFallbackMessage" defaultValue={settings.data.chatbotFallbackMessage} data-testid="input-chatbot-fallback" />
            <label className="block space-y-1.5">
              <span className="text-[12px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">Baza wiedzy (jedna reguła na linię: słowa kluczowe =&gt; odpowiedź)</span>
              <textarea name="chatbotKnowledgeBase" defaultValue={settings.data.chatbotKnowledgeBase} className="focus-ring w-full min-h-[200px] rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-3.5 text-sm text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))]" data-testid="input-chatbot-knowledge" placeholder="np. cennik, koszty, prowizja => Aplikacja jest darmowa dla klientów." />
            </label>
          </section>

          <Button type="submit" disabled={updateSettings.isPending} data-testid="button-save-settings">
            {updateSettings.isPending ? 'Zapisywanie...' : 'Zapisz ustawienia'}
          </Button>
          {updateSettings.isSuccess && <p className="mt-3 text-sm font-bold text-green-600">Zapisano zmiany pomyślnie!</p>}
        </form>
      )}
    </AppShell>
  );
}

function AdminModerationPage() {
  const { profile, isLoading: isProfileLoading, isError: isProfileError } = useSessionProfile();
  const users = useListAdminUsers({ role: 'all' }, { query: { queryKey: getListAdminUsersQueryKey({ role: 'all' }), enabled: profile.role === 'admin' } });
  const requests = useListAdminRequests({ query: { queryKey: getListAdminRequestsQueryKey(), enabled: profile.role === 'admin' } });
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();
  const deleteRequest = useDeleteAdminRequest();
  const updateRequest = useUpdateAdminRequest();
  if (isProfileLoading) return <AppShell profile={profile}><LoadingState lines={4} /></AppShell>;
  if (isProfileError) return <StatusPage code="401" title="Nie udało się wczytać konta." copy="Odśwież stronę lub zaloguj się ponownie." />;
  if (profile.role !== 'admin') return <StatusPage code="403" title="Brak dostępu." copy="Ta część aplikacji jest dostępna wyłącznie dla administratora." />;
  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey({ role: 'all' }) });
  const refreshRequests = () => queryClient.invalidateQueries({ queryKey: getListAdminRequestsQueryKey() });
  return <AppShell profile={profile}><PageHeading eyebrow="Panel administratora" title="Moderacja platformy" copy="Blokuj konta łamiące regulamin i usuwaj zbędne dane." />
    <section className="mb-10"><h2 className="mb-4 text-2xl font-bold">Użytkownicy</h2>{users.isLoading ? <LoadingState /> : users.isError ? <ErrorState /> : <div className="space-y-3">{users.data?.map(user => <div key={user.id} className="rounded-2xl border bg-[hsl(var(--card))] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold">{user.firstName} {user.lastName} <span className="text-xs text-[hsl(var(--muted-foreground))]">· {user.role === 'contractor' ? 'Fachowiec' : 'Zleceniodawca'}</span></p><p className="text-sm text-[hsl(var(--muted-foreground))]">{user.email} · {user.phone}</p>{user.isBlocked && <p className="mt-2 text-sm font-semibold text-[hsl(var(--destructive))]">Zablokowane: {user.blockedReason}</p>}</div><div className="flex gap-2"><Button variant="outline" onClick={() => { const reason = user.isBlocked ? null : window.prompt('Powód blokady (naruszenie regulaminu):'); if (!user.isBlocked && !reason) return; updateUser.mutate({ profileId: user.id, data: { action: user.isBlocked ? 'unblock' : 'block', reason } }, { onSuccess: refreshUsers }); }} data-testid={`button-block-user-${user.id}`}>{user.isBlocked ? 'Odblokuj' : 'Zablokuj'}</Button><Button variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => { if (window.confirm(`Trwale usunąć konto ${user.email} wraz z powiązanymi danymi?`)) deleteUser.mutate({ profileId: user.id }, { onSuccess: refreshUsers }); }} data-testid={`button-delete-user-${user.id}`}>Usuń konto</Button></div></div></div>)}</div>}</section>
    <section><h2 className="mb-4 text-2xl font-bold">Zlecenia</h2>{requests.isLoading ? <LoadingState /> : requests.isError ? <ErrorState /> : <div className="space-y-3">{requests.data?.map(request => <div key={request.id} className="rounded-2xl border bg-[hsl(var(--card))] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold">{request.title}</p><p className="text-sm text-[hsl(var(--muted-foreground))]">{request.customerName} · {request.location} · {statusLabels[request.status]}</p>{request.isBlocked && <p className="mt-2 text-sm font-semibold text-[hsl(var(--destructive))]">Zablokowane: {request.blockedReason}</p>}</div><div className="flex gap-2"><Button variant="outline" onClick={() => { const reason = request.isBlocked ? null : window.prompt('Powód blokady:'); if (!request.isBlocked && !reason) return; updateRequest.mutate({ id: request.id, data: { action: request.isBlocked ? 'unblock' : 'block', reason } }, { onSuccess: refreshRequests }); }} data-testid={`button-block-request-${request.id}`}>{request.isBlocked ? 'Odblokuj' : 'Zablokuj'}</Button><Button variant="ghost" className="text-[hsl(var(--destructive))]" onClick={() => { if (window.confirm(`Trwale usunąć zlecenie „${request.title}”?`)) deleteRequest.mutate({ id: request.id }, { onSuccess: refreshRequests }); }} data-testid={`button-delete-request-${request.id}`}>Usuń zlecenie</Button></div></div></div>)}</div>}</section>
  </AppShell>;
}

function DashboardRoute() {
  const { profile, isLoading, isError } = useSessionProfile();

  if (isLoading) return <AppShell profile={profile}><LoadingState lines={4} /></AppShell>;
  if (isError) return <StatusPage code="401" title="Nie udało się wczytać konta." copy="Odśwież stronę lub zaloguj się ponownie." />;
  return profile.role === 'admin' ? <AdminOverviewPage /> : <Dashboard />;
}

function AppRouter() {
  return <ErrorBoundary resetKey={location.pathname}><Switch><Route path="/" component={Landing} /><Route path="/politykaprywatnosci" component={PrivacyPolicy} /><Route path="/regulamin-pakietu" component={PremiumTerms} /><Route path="/regulamin" component={TermsOfService} /><Route path="/auth" component={RealAuthPage} /><Route path="/dashboard" component={DashboardRoute} /><Route path="/messages" component={Messages} /><Route path="/requests/new" component={NewRequest} /><Route path="/requests/:id" component={RequestDetail} /><Route path="/requests" component={Requests} /><Route path="/billing" component={ProtectedBilling} /><Route path="/profile" component={ProfilePage} /><Route path="/admin/overview" component={AdminOverviewPage} /><Route path="/admin/subscriptions" component={AdminSubscriptionsPage} /><Route path="/admin/moderation" component={AdminModerationPage} /><Route path="/admin/settings" component={AdminSettingsPage} /><Route component={() => <StatusPage code="404" title="Tej strony tu nie ma." copy="Wygląda na to, że ten adres się zgubił. Wróćmy do konkretów." />} /></Switch></ErrorBoundary>;
}

function SeoRouteMeta() {
  const [location] = useLocation();

  useEffect(() => {
    const path = location.split("?")[0].replace(/\/+$/, "") || "/";
    const metadata: Record<string, { title: string; description: string; index: boolean }> = {
      "/": {
        title: "Fachowiec, majster i ekipa remontowa | Zleć Majstra",
        description: "Znajdź fachowca do remontu w swojej okolicy. Zleć pracę hydraulikowi, elektrykowi, płytkarzowi lub ekipie remontowej i porównaj oferty.",
        index: true,
      },
      "/regulamin": {
        title: "Regulamin serwisu | Zleć Majstra",
        description: "Regulamin korzystania z platformy Zleć Majstra dla zleceniodawców i fachowców remontowych.",
        index: true,
      },
      "/politykaprywatnosci": {
        title: "Polityka prywatności | Zleć Majstra",
        description: "Informacje o prywatności i przetwarzaniu danych w platformie Zleć Majstra.",
        index: true,
      },
      "/regulamin-pakietu": {
        title: "Regulamin pakietu dla fachowców | Zleć Majstra",
        description: "Zasady korzystania z pakietu dla fachowców i dostępu do zleceń remontowych w Zleć Majstra.",
        index: true,
      },
    };
    const current = metadata[path] ?? {
      title: "Zleć Majstra — platforma zleceń remontowych",
      description: "Połącz się z fachowcem lub znajdź konkretne zlecenia remontowe w swojej okolicy.",
      index: false,
    };
    document.title = current.title;
    const setMeta = (selector: string, attribute: "content" | "href", value: string) => {
      const element = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (element) element.setAttribute(attribute, value);
    };
    setMeta('meta[name="description"]', "content", current.description);
    setMeta('meta[name="robots"]', "content", current.index ? "index, follow" : "noindex, nofollow");
    setMeta('meta[property="og:title"]', "content", current.title);
    setMeta('meta[property="og:description"]', "content", current.description);
    setMeta('meta[property="og:url"]', "content", `https://zlecmajstra.pl${path === "/" ? "/" : path}`);
    setMeta('link[rel="canonical"]', "href", `https://zlecmajstra.pl${path === "/" ? "/" : path}`);
  }, [location]);

  return null;
}

function App() {
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} signInUrl={`${basePath}/auth`} signUpUrl={`${basePath}/auth`}><ApiAuthBridge><QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><SeoRouteMeta /><AppRouter /></WouterRouter><Toaster /><ChatbotWidget /></TooltipProvider></QueryClientProvider></ApiAuthBridge></ClerkProvider>;
}

export default App;
