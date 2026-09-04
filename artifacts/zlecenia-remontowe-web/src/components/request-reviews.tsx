import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Star, MessageCircle, Camera } from 'lucide-react';
import {
  type JobRequest,
  type Profile,
  type Review,
  type ReviewCandidate,
  useListReviewCandidates,
  getListReviewCandidatesQueryKey,
  useListRequestReviews,
  getListRequestReviewsQueryKey,
  useCreateRequestReview,
  useCreateReviewReply,
  useAddProjectPhoto,
  useRequestUploadUrl
} from '@workspace/api-client-react';

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'dark' }) {
  const variants = {
    primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(var(--foreground)/.14)] hover:-translate-y-0.5 hover:shadow-[0_5px_0_hsl(var(--foreground)/.14)]',
    outline: 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)]',
    ghost: 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
    dark: 'bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] shadow-[0_3px_0_hsl(var(--foreground)/.14)] hover:-translate-y-0.5'
  };
  return <button {...props} className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}>{children}</button>;
}

export function RequestReviews({ request, profile }: { request: JobRequest; profile: Profile }) {
  const { data: candidates } = useListReviewCandidates(request.id, {
    query: {
      queryKey: getListReviewCandidatesQueryKey(request.id),
      enabled: profile.role === 'customer' && request.status === 'completed'
    }
  });

  const { data: reviews } = useListRequestReviews(request.id, {
    query: {
      queryKey: getListRequestReviewsQueryKey(request.id),
      enabled: request.status === 'completed'
    }
  });

  const unreviewedCandidates = candidates?.filter(c => !c.reviewed) || [];

  if (request.status !== 'completed') {
    return null;
  }

  return (
    <div className="mt-8 space-y-8">
      {profile.role === 'customer' && unreviewedCandidates.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] p-6 md:p-8" data-testid="panel-review-candidates">
          <h2 className="mb-2 font-[var(--app-font-serif)] text-2xl font-bold">Oceń współpracę</h2>
          <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">Zostaw opinię o fachowcach, z którymi współpracowałeś przy tym zleceniu.</p>
          <div className="grid gap-6">
            {unreviewedCandidates.map(candidate => (
              <ReviewForm key={candidate.id} request={request} candidate={candidate} />
            ))}
          </div>
        </div>
      )}

      {reviews && reviews.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8" data-testid="panel-reviews">
          <h2 className="mb-6 font-[var(--app-font-serif)] text-2xl font-bold">Opinie o zleceniu</h2>
          <div className="grid gap-6">
            {reviews.map(review => (
              <ReviewItem key={review.id} review={review} request={request} profile={profile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewForm({ request, candidate }: { request: JobRequest; candidate: ReviewCandidate }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [body, setBody] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const createReview = useCreateRequestReview();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice('');
    if (rating === 0 || !body.trim()) return;
    createReview.mutate({
      id: request.id,
      data: { contractorId: candidate.id, rating, body: body.trim() }
    }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListReviewCandidatesQueryKey(request.id) });
        void queryClient.invalidateQueries({ queryKey: getListRequestReviewsQueryKey(request.id) });
      },
      onError: () => {
        setErrorNotice('Nie udało się zapisać opinii. Spróbuj ponownie.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-[hsl(var(--foreground))]">Oceń: {candidate.displayName}</h3>
      {errorNotice && <p className="mb-4 text-xs font-semibold text-[hsl(var(--destructive))]">{errorNotice}</p>}
      <div className="mb-4 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className="focus-ring rounded p-1 transition"
            onMouseEnter={() => setHoverRating(value)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(value)}
          >
            <Star
              size={24}
              className={value <= (hoverRating || rating) ? 'fill-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground)/.3)]'}
            />
          </button>
        ))}
      </div>
      <label className="block space-y-1.5 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]">Twoja opinia</span>
        <textarea
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Napisz krótko, jak przebiegła współpraca..."
          className="focus-ring min-h-[100px] w-full resize-none rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-3.5 text-sm text-[hsl(var(--foreground))] outline-none transition focus:border-[hsl(var(--primary))]"
          data-testid={`input-review-body-${candidate.id}`}
        />
      </label>
      <Button type="submit" disabled={rating === 0 || createReview.isPending} data-testid={`button-submit-review-${candidate.id}`}>
        {createReview.isPending ? 'Zapisywanie...' : 'Wystaw opinię'}
      </Button>
    </form>
  );
}

function ReviewItem({ review, request, profile }: { review: Review; request: JobRequest; profile: Profile }) {
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const createReply = useCreateReviewReply();
  const requestUpload = useRequestUploadUrl();
  const addPhoto = useAddProjectPhoto();

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice('');
    if (!replyBody.trim()) return;
    createReply.mutate({
      id: request.id,
      reviewId: review.id,
      data: { body: replyBody.trim() }
    }, {
      onSuccess: () => {
        setIsReplying(false);
        void queryClient.invalidateQueries({ queryKey: getListRequestReviewsQueryKey(request.id) });
      },
      onError: () => {
        setErrorNotice('Nie udało się wysłać odpowiedzi.');
      }
    });
  };

  const canReply = profile.role === 'contractor' && profile.id === review.contractorId && !review.reply;
  const canAddPhotos = profile.role === 'contractor' && profile.id === review.contractorId && review.photos.length < 8;

  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    setErrorNotice('');
    try {
      const prepared = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const uploaded = await fetch(prepared.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error('upload failed');
      await addPhoto.mutateAsync({
        id: request.id,
        reviewId: review.id,
        data: { objectPath: prepared.objectPath },
      });
      await queryClient.invalidateQueries({ queryKey: getListRequestReviewsQueryKey(request.id) });
    } catch {
      setErrorNotice('Nie udało się dodać zdjęcia. Użyj JPG, PNG lub WebP do 50 MB.');
    }
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5" data-testid={`review-${review.id}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-[hsl(var(--border))] pb-4">
        <div>
          <div className="mb-1 text-sm font-bold">{review.contractorName}</div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                size={14}
                className={value <= review.rating ? 'fill-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground)/.3)]'}
              />
            ))}
          </div>
        </div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          {new Date(review.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
      {review.body ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-[hsl(var(--foreground))]">{review.body}</p>
      ) : (
        <p className="text-sm italic text-[hsl(var(--muted-foreground))]">Oceniono bez komentarza.</p>
      )}
      {review.photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {review.photos.map((photo) => <img key={photo.id} src={photo.imageUrl} alt="Zdjęcie zakończonej realizacji" className="aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" />)}
      </div>}
      {canAddPhotos && <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold hover:bg-[hsl(var(--muted))]">
        <Camera size={15} />{requestUpload.isPending || addPhoto.isPending ? 'Przesyłanie…' : 'Dodaj zdjęcie realizacji'}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={requestUpload.isPending || addPhoto.isPending} onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
      </label>}

      {review.reply && (
        <div className="mt-4 rounded-xl bg-[hsl(var(--muted)/.5)] p-4 border border-[hsl(var(--border))]">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[hsl(var(--foreground))]">
            <MessageCircle size={14} className="text-[hsl(var(--primary))]" />
            Odpowiedź fachowca
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[hsl(var(--foreground)/.8)]">{review.reply.body}</p>
        </div>
      )}

      {canReply && !isReplying && (
        <button
          onClick={() => setIsReplying(true)}
          className="mt-4 text-xs font-bold text-[hsl(var(--primary))] hover:underline"
          data-testid={`button-reply-${review.id}`}
        >
          Odpowiedz na opinię
        </button>
      )}

      {canReply && isReplying && (
        <form onSubmit={handleReply} className="mt-5 rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.05)] p-4">
          {errorNotice && <p className="mb-3 text-xs font-semibold text-[hsl(var(--destructive))]">{errorNotice}</p>}
          <label className="block space-y-1.5 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[.11em] text-[hsl(var(--primary))]">Twoja odpowiedź</span>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Napisz profesjonalną odpowiedź..."
              className="focus-ring min-h-[80px] w-full resize-none rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--card))] p-3.5 text-sm text-[hsl(var(--foreground))] outline-none transition focus:border-[hsl(var(--primary))]"
              data-testid={`input-reply-body-${review.id}`}
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={!replyBody.trim() || createReply.isPending} data-testid={`button-submit-reply-${review.id}`}>
              {createReply.isPending ? 'Wysyłanie...' : 'Wyślij odpowiedź'}
            </Button>
            <Button variant="ghost" type="button" onClick={() => setIsReplying(false)} disabled={createReply.isPending}>
              Anuluj
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
