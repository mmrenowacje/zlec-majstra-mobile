import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, Mail, MessageCircle, Phone, Send, ShieldCheck, Star } from 'lucide-react';
import {
  getGetRequestConversationByIdQueryKey,
  getGetRequestConversationQueryKey,
  getGetRequestQueryKey,
  getGetContractorProfileQueryKey,
  getGetNotificationsQueryKey,
  getListRequestConversationsQueryKey,
  type Profile,
  useGetRequest,
  useGetContractorProfile,
  useGetRequestConversation,
  useGetRequestConversationById,
  useListRequestConversations,
  useSendConversationMessage,
  useSendConversationMessageById,
  useShareRequestContactById,
  useStartRequestConversation,
} from '@workspace/api-client-react';

function RequestAddressPanel({ requestId, role }: { requestId: number; role: Profile['role'] }) {
  const request = useGetRequest(requestId, {
    query: { queryKey: getGetRequestQueryKey(requestId) },
  });

  if (!request.data) return null;
  if (!request.data.address) {
    return role === 'contractor' ? (
      <div className="mb-4 flex items-start gap-3 rounded-2xl border bg-[hsl(var(--card))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        <LockKeyhole size={17} className="mt-0.5 shrink-0" />
        <span>Dokładny adres zlecenia będzie widoczny po udostępnieniu danych kontaktowych.</span>
      </div>
    ) : null;
  }

  return <div className="mb-4 rounded-2xl border bg-[hsl(var(--secondary))] p-4" data-testid="request-address">
    <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Adres zlecenia</p>
    <p className="mt-2 text-sm font-bold">{request.data.address}</p>
  </div>;
}

export function RequestConversation({ requestId, profile, initialConversationId = null }: { requestId: number; profile: Profile; initialConversationId?: number | null }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const contractorKey = getGetRequestConversationQueryKey(requestId);
  const listKey = getListRequestConversationsQueryKey(requestId);
  const contractorConversation = useGetRequestConversation(requestId, {
    query: {
      queryKey: contractorKey,
      retry: false,
      refetchInterval: 3000,
      enabled: profile.role === 'contractor',
    },
  });
  const customerConversations = useListRequestConversations(requestId, {
    query: {
      queryKey: listKey,
      retry: false,
      refetchInterval: 3000,
      enabled: profile.role === 'customer',
    },
  });
  useEffect(() => {
    if (profile.role !== 'customer' || !customerConversations.data?.length) return;
    if (
      initialConversationId !== null &&
      customerConversations.data.some((item) => item.id === initialConversationId) &&
      selectedConversationId !== initialConversationId
    ) {
      setSelectedConversationId(initialConversationId);
      return;
    }
    if (!customerConversations.data.some((item) => item.id === selectedConversationId)) {
      setSelectedConversationId(customerConversations.data[0].id);
    }
  }, [customerConversations.data, initialConversationId, profile.role, selectedConversationId]);
  const customerKey = getGetRequestConversationByIdQueryKey(
    requestId,
    selectedConversationId ?? 0,
  );
  const customerConversation = useGetRequestConversationById(
    requestId,
    selectedConversationId ?? 0,
    {
      query: {
        queryKey: customerKey,
        retry: false,
        refetchInterval: 3000,
        enabled: profile.role === 'customer' && selectedConversationId !== null,
      },
    },
  );
  const conversation =
    profile.role === 'customer' ? customerConversation : contractorConversation;
  const contractorProfile = useGetContractorProfile(conversation.data?.contractorId ?? '', {
    query: { queryKey: getGetContractorProfileQueryKey(conversation.data?.contractorId ?? ''), enabled: profile.role === 'customer' && Boolean(conversation.data?.contractorId), retry: false },
  });
  const start = useStartRequestConversation();
  const send = useSendConversationMessage();
  const sendById = useSendConversationMessageById();
  const shareById = useShareRequestContactById();
  const refreshedNotificationsFor = useRef<number | null>(null);
  useEffect(() => {
    if (conversation.data?.id && refreshedNotificationsFor.current !== conversation.data.id) {
      refreshedNotificationsFor.current = conversation.data.id;
      void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    }
  }, [conversation.data?.id, queryClient]);
  useEffect(() => {
    if (profile.role === 'contractor' && conversation.data?.customerContactShared) {
      void queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
    }
  }, [conversation.data?.customerContactShared, profile.role, queryClient, requestId]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: contractorKey });
    queryClient.invalidateQueries({ queryKey: listKey });
    if (selectedConversationId !== null) {
      queryClient.invalidateQueries({ queryKey: customerKey });
    }
  };

  if (!conversation.data) {
    if (profile.role !== 'contractor') {
      return <RequestAddressPanel requestId={requestId} role={profile.role} />;
    }
    return <><RequestAddressPanel requestId={requestId} role={profile.role} /><section className="mt-6 rounded-2xl border bg-[hsl(var(--card))] p-6">
      <MessageCircle className="text-[hsl(var(--primary))]" />
      <h2 className="mt-3 text-xl font-bold">Porozmawiaj ze zleceniodawcą</h2>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Rozmowa nie ujawnia telefonu ani e-maila. Zleceniodawca udostępni je, gdy po rozmowie zdecyduje się kontynuować kontakt.</p>
      <button className="mt-5 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold" disabled={start.isPending} onClick={() => start.mutate({ id: requestId }, { onSuccess: (result) => queryClient.setQueryData(contractorKey, result), onError: () => setNotice('Rozmowę może rozpocząć fachowiec z aktywnym, opłaconym abonamentem.') })}>
        {start.isPending ? 'Otwieranie…' : 'Otwórz komunikator'}
      </button>
      {notice && <p className="mt-3 text-sm font-semibold text-[hsl(var(--destructive))]">{notice}</p>}
    </section></>;
  }

  const data = conversation.data;
  const contractorHasMessaged = data.messages.some(
    (message) => message.senderId === data.contractorId,
  );
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = body.trim();
    if (!message) return;
    const options = {
      onSuccess: () => { setBody(''); refresh(); },
      onError: () => setNotice('Nie udało się wysłać wiadomości.'),
    };
    if (profile.role === 'customer' && selectedConversationId !== null) {
      sendById.mutate(
        { id: requestId, conversationId: selectedConversationId, data: { body: message } },
        options,
      );
    } else {
      send.mutate({ id: requestId, data: { body: message } }, options);
    }
  };
  const sending = send.isPending || sendById.isPending;

  return <><RequestAddressPanel requestId={requestId} role={profile.role} /><section className="mt-6 overflow-hidden rounded-2xl border bg-[hsl(var(--card))]">
    <header className="flex items-center justify-between gap-3 border-b p-5">
      <div><h2 className="flex items-center gap-2 text-xl font-bold"><MessageCircle size={20} /> Rozmowa o zleceniu</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Telefon i e-mail są chronione do decyzji zleceniodawcy.</p></div>
      {data.customerContactShared ? <span className="flex items-center gap-1 text-xs font-bold text-[hsl(var(--secondary-foreground))]"><ShieldCheck size={16} /> Kontakt udostępniony</span> : <LockKeyhole size={18} />}
    </header>
    {profile.role === 'customer' && (customerConversations.data?.length ?? 0) > 1 && <div className="flex flex-wrap gap-2 border-b px-5 py-3">{customerConversations.data?.map((item, index) => <button key={item.id} type="button" onClick={() => setSelectedConversationId(item.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${item.id === selectedConversationId ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]'}`}>Fachowiec {index + 1}</button>)}</div>}
       {profile.role === 'customer' && contractorHasMessaged && <div className="border-b bg-[hsl(var(--primary)/.05)] px-5 py-4" data-testid="panel-contractor-reviews">
       <div className="flex flex-wrap items-center justify-between gap-3">
         <div>
           <p className="text-sm font-bold">Oceny fachowca: {data.contractorName}</p>
           <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Sprawdź wcześniejsze opinie przed podjęciem decyzji.</p>
         </div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setProfileOpen(value => !value)} className="rounded-full border bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-bold" data-testid="button-contractor-profile">{profileOpen ? 'Ukryj profil' : 'Obejrzyj profil'}</button><div className="flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-sm font-bold">
           <Star size={15} className="fill-[hsl(var(--primary))] text-[hsl(var(--primary))]" />
           {data.contractorReviewCount > 0 ? `${data.contractorAverageRating.toFixed(1)} (${data.contractorReviewCount})` : 'Brak ocen'}
          </div></div>
       </div>
        {profileOpen && contractorProfile.data && <div className="mt-4 rounded-xl border bg-[hsl(var(--card))] p-4" data-testid="contractor-profile"><div className="flex items-center gap-3">{contractorProfile.data.profileImageUrl ? <img src={contractorProfile.data.profileImageUrl} alt="" className="size-14 rounded-full object-cover" /> : <div className="grid size-14 place-items-center rounded-full bg-[hsl(var(--muted))] text-lg font-bold">{contractorProfile.data.firstName[0]}</div>}<div><p className="font-bold">{contractorProfile.data.companyName || `${contractorProfile.data.firstName} ${contractorProfile.data.lastName}`}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{contractorProfile.data.companyAddress} · obszar {contractorProfile.data.serviceLocation}</p><p className="mt-1 text-xs font-semibold">NIP: {contractorProfile.data.nip} {contractorProfile.data.verified ? '· konto zweryfikowane' : ''}</p></div></div>{contractorProfile.data.completedProjects.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{contractorProfile.data.completedProjects.slice(0, 8).map(photo => <img key={photo.id} src={photo.imageUrl} alt="Realizacja fachowca" className="aspect-[4/3] w-full rounded-lg object-cover" />)}</div>}</div>}
       {data.contractorReviews.length > 0 && <div className="mt-4 grid gap-3">
         {data.contractorReviews.map((review) => <article key={review.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
           <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-1">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} className={index < review.rating ? 'fill-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground)/.3)]'} />)}</div>
             <time className="text-[10px] text-[hsl(var(--muted-foreground))]">{new Date(review.createdAt).toLocaleDateString('pl-PL')}</time>
           </div>
           <p className="mt-2 text-sm leading-relaxed">{review.body}</p>
            {review.photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {review.photos.map((photo) => <img key={photo.id} src={photo.imageUrl} alt="Zakończona realizacja fachowca" className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />)}
            </div>}
         </article>)}
       </div>}
     </div>}
    <div className="max-h-[420px] space-y-3 overflow-y-auto bg-[hsl(var(--muted)/.35)] p-5">
      {data.messages.length === 0 && <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Napisz pierwszą wiadomość i ustal szczegóły.</p>}
      {data.messages.map(message => <div key={message.id} className={`flex ${message.senderId === profile.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${message.senderId === profile.id ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border bg-[hsl(var(--card))]'}`}><p className="whitespace-pre-wrap">{message.body}</p><time className="mt-1 block text-[10px] opacity-65">{new Date(message.createdAt).toLocaleString('pl-PL')}</time></div></div>)}
    </div>
    {profile.role === 'contractor' && data.customerContactShared && <div className="flex flex-wrap gap-4 border-t bg-[hsl(var(--secondary))] px-5 py-4 text-sm font-bold">{data.customerPhone && <span className="flex items-center gap-2"><Phone size={15} />{data.customerPhone}</span>}{data.customerEmail && <span className="flex items-center gap-2"><Mail size={15} />{data.customerEmail}</span>}</div>}
    {profile.role === 'customer' && !data.customerContactShared && <div className="border-t px-5 py-4"><button className="rounded-xl bg-[hsl(var(--secondary))] px-4 py-2.5 text-sm font-bold" disabled={shareById.isPending || data.messages.length === 0 || selectedConversationId === null} onClick={() => selectedConversationId !== null && shareById.mutate({ id: requestId, conversationId: selectedConversationId }, { onSuccess: (result) => { queryClient.setQueryData(customerKey, result); queryClient.invalidateQueries({ queryKey: listKey }); queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) }); } })}>Udostępnij temu fachowcowi telefon, e-mail i adres zlecenia</button><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Zrób to dopiero po rozmowie, gdy chcesz kontynuować kontakt poza aplikacją.</p></div>}
    <form onSubmit={submit} className="flex gap-3 border-t p-4"><textarea value={body} onChange={event => setBody(event.target.value)} maxLength={2000} rows={2} placeholder="Napisz wiadomość…" className="min-h-11 flex-1 resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]" /><button type="submit" disabled={sending || !body.trim()} className="self-end rounded-xl bg-[hsl(var(--primary))] p-3" aria-label="Wyślij wiadomość"><Send size={18} /></button></form>
    {notice && <p className="px-5 pb-4 text-sm text-[hsl(var(--destructive))]">{notice}</p>}
  </section></>;
}